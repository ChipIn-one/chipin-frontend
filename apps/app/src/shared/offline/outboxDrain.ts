// The drain lock (spec 03 §2.3, D29): any tab of a user appends to the outbox, only the tab that
// holds `chipin-outbox-drain:<userId>` adopts the ops and sends them. A tab with a restored outbox
// requests the lock while it is visible; on acquisition it starts a new drain session (the fence
// of the runs), clears a stale claim, re-reads the keys and adopts them (`restoreOutbox`). It
// releases the lock on hidden (once its request in flight settled), on freeze and on pagehide (the
// request in flight is aborted first), and requests it again on visible/resume/pageshow. On a
// release every waiting run resolves `stopped` without a request, so the next holder adopts its op.
// The tabs ping each other through `outboxChannel.ts`. Without Web Locks the tab drains without the
// lock (offline writing is off there, §2.3: only ops persisted before are sent).
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import {
    closeOutboxChannel,
    openOutboxChannel,
    type OutboxChannelMessage,
    type OutboxChannelStatus,
    postOutboxMessage,
} from './outboxChannel';
import { outboxGate } from './outboxGate';
import { hasWebLocks, onOutboxDisposed } from './outboxIo';
import {
    adoptOutboxOps,
    type OutboxAdoption,
    restoreOutbox,
    runningOutboxOpIds,
    whenOutboxIdle,
} from './outboxRun';
import {
    abortOutboxSends,
    cancelledInKey,
    currentOutboxFence,
    discardOps,
    type DiscardResult,
    failedEntryIds,
    forgetCancelledInKey,
    hasNoFailureOf,
    isOutboxStopped,
    markOpsCancelled,
    onOutboxStatus,
    onOutboxWritten,
    type OutboxOpBase,
    type OutboxRestore,
    outboxStatus,
    pendingOutboxOps,
    readOutbox,
    refreshOutbox,
    requestRetry,
    stopOutbox,
} from './outboxStore';

export const outboxDrainLockName = (userId: string): string => `chipin-outbox-drain:${userId}`;

/** What the page tells the drain (the browser's page lifecycle; a fake one in tests). */
export interface OutboxPage {
    isHidden: () => boolean;
    listen: (on: { hidden: () => void; visible: () => void; frozen: () => void }) => () => void;
}

const browserPage: OutboxPage = {
    isHidden: () => document.visibilityState === 'hidden',
    listen: ({ hidden, visible, frozen }) => {
        const onShow = (): void => (browserPage.isHidden() ? hidden() : visible());
        const events: [EventTarget, string, () => void][] = [
            [document, 'visibilitychange', onShow],
            [document, 'freeze', frozen],
            [document, 'resume', onShow],
            [window, 'pagehide', frozen],
            [window, 'pageshow', onShow],
        ];

        events.forEach(([target, type, listener]) => target.addEventListener(type, listener));
        return () => {
            events.forEach(([target, type, listener]) =>
                target.removeEventListener(type, listener),
            );
        };
    },
};

let page = browserPage;

/** Tests only: the page lifecycle of this "tab". */
export const setOutboxPage = (next: OutboxPage): void => {
    page = next;
};

/** What the drain needs of the outbox's entity: the adoption and the effects of a settled op. */
export interface OutboxDrainHooks extends OutboxAdoption {
    /** Another tab's op settled (`settled`, §2.2): write its entry, read the affected data again. */
    onRemoteSettled: (message: Extract<OutboxChannelMessage, { type: 'settled' }>) => void;
}

interface Drain {
    readonly client: QueryClient;
    readonly userId: string;
    readonly hooks: OutboxDrainHooks;
    /** The lock request, queued or granted (a queued one is withdrawn on freeze and on a stop). */
    request: AbortController | null;
    holding: boolean;
    /** Ends the hold: the lock is released. */
    release: (() => void) | null;
    /** Settles once this drain's lock request has ended (granted and released, or withdrawn). */
    settled: Promise<void>;
    syncing: Promise<void>;
    stopped: boolean;
    /** Frozen or hidden by pagehide: no lock is requested until the page resumes. */
    frozen: boolean;
    unlisten: () => void;
}

let drain: Drain | null = null;
const remoteStatuses = new Map<string, OutboxChannelStatus>();

const holder = (): Drain | null => (drain?.holding === true && !drain.stopped ? drain : null);

/** The badge hint state (§2.3): this tab drains, waits for the drain lock, or has no outbox. */
export const outboxDrainState = (): 'holding' | 'waiting' | 'off' =>
    drain === null || drain.stopped ? 'off' : drain.holding ? 'holding' : 'waiting';

/**
 * §2.3: "Sending runs in another open ChipIn tab" (the header badge of 03-16a shows it): ops are
 * pending online and another tab holds the drain lock.
 */
export const isSendingInAnotherTab = (): boolean =>
    outboxDrainState() === 'waiting' && pendingOutboxOps().length > 0 && onlineManager.isOnline();

/** An op's status: this tab's run, else what the drain tab told (`status`). */
export const outboxOpStatus = (opId: string): OutboxChannelStatus | undefined =>
    holder() ? outboxStatus(opId) : remoteStatuses.get(opId);

const announceStatuses = (): void => {
    pendingOutboxOps().forEach(({ opId }) => {
        postOutboxMessage({ type: 'status', opId, status: outboxStatus(opId) ?? 'queued' });
    });
};

// The holder applies the keys it just read: another tab's discards cancel the waiting runs (and
// the cancellations no run will forget are dropped), the blocks follow the failed list, new ops
// and Retries are adopted.
const applyQueue = (current: Drain): Promise<void> => {
    const running = runningOutboxOpIds(current.client);
    const cancelled = cancelledInKey();
    const orphans = cancelled.filter(opId => !running.has(opId));

    markOpsCancelled(cancelled.filter(opId => running.has(opId)));
    failedEntryIds().forEach(entryId => outboxGate.block(entryId));
    outboxGate.blockedEntryIds().forEach(entryId => {
        if (hasNoFailureOf(entryId)) {
            outboxGate.unblock(entryId);
        }
    });
    adoptOutboxOps(current.client, current.hooks.mutationKeyFor, current.hooks.isAcceptable);
    return forgetCancelledInKey(orphans, currentOutboxFence()).catch(() => undefined);
};

// One at a time: re-read the keys, then (the holder) apply them.
const sync = (current: Drain): Promise<void> => {
    current.syncing = current.syncing
        .then(() => refreshOutbox())
        .then(() => {
            const pending = new Set(pendingOutboxOps().map(({ opId }) => opId));

            [...remoteStatuses.keys()].forEach(opId => {
                if (!pending.has(opId)) {
                    remoteStatuses.delete(opId);
                }
            });
            return holder() === current && !isOutboxStopped() ? applyQueue(current) : undefined;
        });
    return current.syncing;
};

const onMessage = (current: Drain, message: OutboxChannelMessage): void => {
    if (drain !== current) {
        return;
    }
    switch (message.type) {
        case 'changed':
            void sync(current);
            return;
        case 'status-request':
            if (holder() === current) {
                announceStatuses();
            }
            return;
        case 'status':
            remoteStatuses.set(message.opId, message.status);
            return;
        case 'settled':
            current.hooks.onRemoteSettled(message);
    }
};

// The drain session: it lasts while the lock is held. A tab hidden (or stopped) when the lock comes
// does not drain: it releases it at once.
const hold = (current: Drain, started: () => void): Promise<void> => {
    if (drain !== current || current.stopped || page.isHidden()) {
        started();
        return Promise.resolve();
    }
    current.holding = true;
    remoteStatuses.clear();
    return new Promise<void>(release => {
        current.release = release;
        void restoreOutbox(current.client, current.userId, current.hooks)
            .then(() => {
                if (holder() !== current || isOutboxStopped()) {
                    return undefined;
                }
                announceStatuses();
                return applyQueue(current);
            })
            .then(started);
    }).finally(() => {
        current.holding = false;
        current.release = null;
    });
};

const requestLock = (current: Drain): Promise<void> => {
    if (
        drain !== current ||
        current.stopped ||
        current.frozen ||
        current.holding ||
        current.request ||
        page.isHidden()
    ) {
        return Promise.resolve();
    }
    if (!hasWebLocks()) {
        return new Promise(started => {
            void hold(current, started).then(() => requestLock(current));
        });
    }
    const controller = new AbortController();
    const name = outboxDrainLockName(current.userId);

    current.request = controller;
    return new Promise<void>(started => {
        // Granted at once (the restore is awaited by the caller), else queued behind the holder.
        const granted: Promise<unknown> = navigator.locks
            .request(name, { ifAvailable: true }, lock =>
                lock === null ? false : hold(current, started).then(() => true),
            )
            .then(wasGranted => {
                if (wasGranted !== false) {
                    return undefined;
                }
                started();
                return navigator.locks.request(name, { signal: controller.signal }, () =>
                    hold(current, () => undefined),
                );
            })
            .catch(() => {
                // Withdrawn (frozen, stopped): not an error.
                started();
            })
            .finally(() => {
                if (current.request === controller) {
                    current.request = null;
                }
                // Released while the tab became visible again: it queues for the lock again.
                if (drain === current && !current.stopped) {
                    void requestLock(current);
                }
            });

        current.settled = current.settled.then(() => granted).then(() => undefined);
    });
};

// §2.3: hidden → the lock goes once no request is in flight (a queued request stays: granted while
// hidden, it is released at once); freeze/pagehide → the request in flight is aborted first and
// the queued request withdrawn (a frozen tab must not be granted the lock).
const releaseLock = (current: Drain, { abort }: { abort: boolean }): Promise<void> => {
    if (abort) {
        current.request?.abort();
    }
    if (!current.holding) {
        return Promise.resolve();
    }
    if (abort) {
        abortOutboxSends();
    }
    stopOutbox();
    return (abort ? Promise.resolve() : whenOutboxIdle()).then(() => {
        current.release?.();
    });
};

/**
 * Starts the outbox of `userId` in this tab: reads both keys (`outboxRestore`, §1.6), listens on the
 * channel and the page, asks the drain tab for the statuses and, with the restore `ok`, requests the
 * drain lock. Resolves with the restore result once the lock was granted and adopted, or queued.
 * Replaces the previous outbox of the tab.
 */
export const startOutboxDrain = (
    client: QueryClient,
    userId: string,
    hooks: OutboxDrainHooks,
): Promise<OutboxRestore> => {
    // A repeated start of the same client (a remount): the holder re-reads and adopts what is new
    // (no op twice), or starts a new drain session after a stop; a waiting tab keeps waiting.
    if (drain?.client === client && drain.userId === userId) {
        const current = drain;

        return readOutbox(userId).then(result => {
            if (holder() !== current) {
                return requestLock(current).then(() => result);
            }
            return (
                isOutboxStopped() ? restoreOutbox(client, userId, current.hooks) : sync(current)
            ).then(() => result);
        });
    }
    const previous = stopOutboxDrain();
    const current: Drain = {
        client,
        userId,
        hooks,
        request: null,
        holding: false,
        release: null,
        settled: Promise.resolve(),
        syncing: Promise.resolve(),
        stopped: false,
        frozen: false,
        unlisten: () => undefined,
    };

    drain = current;
    // §2.3: closed until this tab holds the drain lock and the owner check opens it.
    outboxGate.close('auth');
    current.unlisten = page.listen({
        hidden: () => void releaseLock(current, { abort: false }),
        frozen: () => {
            current.frozen = true;
            void releaseLock(current, { abort: true });
        },
        visible: () => {
            current.frozen = false;
            void sync(current);
            void requestLock(current);
        },
    });
    openOutboxChannel(userId, message => onMessage(current, message));
    return previous
        .then(() => readOutbox(userId))
        .then(result => {
            if (drain !== current || result !== 'ok') {
                return result;
            }
            postOutboxMessage({ type: 'status-request' });
            return requestLock(current).then(() => result);
        });
};

/**
 * Stops the outbox of this tab (logout, user change, `clearUserData` step (1)): the lock request is
 * withdrawn, the lock released, the channel closed and the page no longer listened to. Resolves
 * once the lock is released.
 */
export const stopOutboxDrain = (): Promise<void> => {
    const current = drain;

    if (!current) {
        return Promise.resolve();
    }
    drain = null;
    current.stopped = true;
    current.unlisten();
    closeOutboxChannel();
    remoteStatuses.clear();
    current.request?.abort();
    if (current.holding) {
        stopOutbox();
        current.release?.();
    }
    return current.settled.catch(() => undefined);
};

// `clearUserData(userId)` step (1): the drain lock and the channel go with the user's outbox.
onOutboxDisposed(userId => {
    if (drain?.userId === userId) {
        void stopOutboxDrain();
    }
});

// Every write of this tab tells the other tabs; the holder tells them each status.
onOutboxWritten(() => {
    if (drain) {
        postOutboxMessage({ type: 'changed' });
    }
});
onOutboxStatus((opId, status) => {
    if (holder()) {
        postOutboxMessage({ type: 'status', opId, status });
    }
});

/** After this tab appended: the holder adopts its op at once (other tabs learn it by `changed`). */
export const adoptIfDraining = (): void => {
    const current = holder();

    if (current && !isOutboxStopped()) {
        adoptOutboxOps(current.client, current.hooks.mutationKeyFor, current.hooks.isAcceptable);
    }
};

/** The drain tab tells the others that an op settled (`settled`, §2.2). */
export const announceOutboxSettled = (
    op: OutboxOpBase,
    result: 'sent' | 'failed',
    entry: unknown,
): void => {
    // The run's own tab announces it, also when the lock was released while it settled.
    if (drain && !drain.stopped) {
        postOutboxMessage({ type: 'settled', op, result, ...(entry != null && { entry }) });
    }
};

const syncIfHolder = (): Promise<void> => {
    const current = holder();

    return current ? sync(current) : Promise.resolve();
};

/** "Cancel" from any tab (C3-04): a claimed op is refused; the holder applies it at once. */
export const discardOutboxOps = (opIds: readonly string[]): Promise<DiscardResult> =>
    discardOps(opIds).then(result => syncIfHolder().then(() => result));

/** "Retry" from any tab (§2.3): the holder adopts the failed ops; resolves with the requested ids. */
export const retryOutboxOps = (opIds: readonly string[]): Promise<string[]> =>
    requestRetry(opIds).then(requested => syncIfHolder().then(() => requested));
