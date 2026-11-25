// Sending the outbox (spec 03 §2.4, §2.5, D29): one op at a time in `seq` order, a failed op
// blocks only later ops of its own entry. `runOutboxOp` settles only with a success, a no-op
// result or a final error; everything else (no network, 5xx, the auth and outdated gates) waits
// inside it, holding the turn. It is the `mutationFn` of the outbox mutations (`retry: false`,
// `networkMode: 'always'`: the wait is here, not in the TanStack retryer; owner item 35).
import * as Sentry from '@sentry/react';
import type { MutationKey, QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';

import {
    ApiResponseFormatError,
    AuthRequestCancelledError,
    isNetworkError,
    isRequestCancelled,
    isRequestNotSent,
} from 'shared/api/client';
import { ApiError } from 'shared/lib/apiError';

import { outboxGate } from './outboxGate';
import { OutboxLockTimeoutError, OutboxWriteStoppedError } from './outboxIo';
import { ledgerEntryKey } from './outboxRegistry';
import {
    claimOutboxOp,
    convertFailedConflicts,
    currentOutboxFence,
    failedEntryIds,
    type FailedReason,
    forgetCancelled,
    getOutboxVersion,
    hasNoFailureOf,
    isDrainFence,
    isOpCancelled,
    isOpCancelledInKey,
    isOpFailed,
    isOutboxStopped,
    isOwnerFence,
    isPendingRemoval,
    isRetryRequested,
    markPendingRemoval,
    noteOutboxVersion,
    onOutboxWake,
    type OutboxConflict,
    outboxEntryIds,
    type OutboxFence,
    type OutboxKind,
    type OutboxOpBase,
    outboxOwner,
    type OutboxRestore,
    outboxSessionSignal,
    pendingOutboxOps,
    readOutbox,
    recordConflict,
    recordFailedOp,
    refreshOutbox,
    releaseOutboxClaim,
    removeOutboxOp,
    restoreOutboxVersions,
    retryRequestedOps,
    setOutboxStatus,
    startOutbox,
    trackFailureWrite,
    writeOutbox,
} from './outboxStore';
import { reportPersistFailed } from './queryPersister';

/** What a sent op answered: the entry's new version and the entry (both null for a delete). */
export interface OutboxSent {
    version: string | null;
    entry: unknown;
}

export type OutboxResult =
    | { kind: 'sent'; entry: unknown }
    /** The drain stopped: the op stays queued for the next drain. */
    | { kind: 'stopped' }
    /** Discarded: no request was sent. */
    | { kind: 'cancelled' }
    /**
     * §2.6: a 409 `LEDGER.VERSION_CONFLICT` (or an unknown version the server has): `entry` is its
     * `current`; the op and the later ops of its entry left the queue, into a conflict draft unless
     * the run ended with a delete (`isDelete`).
     */
    | { kind: 'conflicted'; entry: unknown; isDelete: boolean };

const STOPPED: OutboxResult = { kind: 'stopped' };
const CANCELLED: OutboxResult = { kind: 'cancelled' };
const NO_OP: OutboxSent = { version: null, entry: null };

/** The op failed for good: it is in the failed list and its entry is blocked. */
export class OutboxTerminalError extends Error {
    override readonly name = 'OutboxTerminalError';
    readonly reason: FailedReason;

    constructor(reason: FailedReason) {
        super(`Outbox op failed: ${reason}`);
        this.reason = reason;
    }
}

/** An edit or a delete without a known version whose entry is gone (GET 404, §2.1). */
export class OutboxEntryGoneError extends Error {
    override readonly name = 'OutboxEntryGoneError';
}

export interface OutboxDeps<Op extends OutboxOpBase> {
    /**
     * Sends one op; `knownVersion` is our latest write of the entry (§2.1), else null. `signal` is
     * aborted when the drain is released on freeze/pagehide (§2.3).
     */
    send: (op: Op, knownVersion: string | null, signal: AbortSignal) => Promise<OutboxSent>;
    /** The `sub` of the current access token (§2.3), compared with `op.owner` before each send. */
    sessionUserId: () => string | null;
}

export type OutboxErrorClass =
    | { kind: 'network' | 'transient' | 'auth' | 'outdated' | 'noop' }
    | { kind: 'conflict'; current: unknown }
    | { kind: 'final'; reason: FailedReason };

const final = (reason: FailedReason): OutboxErrorClass => ({ kind: 'final', reason });

const classifyStatus = (
    { status, code, current }: ApiError,
    opKind: OutboxKind,
): OutboxErrorClass => {
    if (status >= 500 || status === 429 || (status === 409 && code === 'SYSTEM.CONFLICT')) {
        return { kind: 'transient' };
    }
    if (
        (status === 404 && opKind === 'deleteExpense') ||
        (status === 410 && opKind === 'createExpense' && code === 'LEDGER.ENTRY_DELETED')
    ) {
        return { kind: 'noop' };
    }
    switch (status) {
        case 401:
            return { kind: 'auth' };
        case 426:
            return { kind: 'outdated' };
        case 400:
        case 422:
            return final('validation');
        case 403:
            return final('forbidden');
        case 404:
            return final(opKind === 'updateExpense' ? 'deletedRemotely' : 'rejected');
        case 409:
            // §2.6: an edit or a delete; a create has no version to conflict with.
            if (code === 'LEDGER.VERSION_CONFLICT') {
                return opKind === 'createExpense'
                    ? final('rejected')
                    : { kind: 'conflict', current };
            }
            return final(code === 'LEDGER.ID_CONFLICT' ? 'idConflict' : 'rejected');
        default:
            return final('rejected');
    }
};

/** The retry policy of §2.4/§2.5 for one failed send. */
export const classifyOutboxError = (error: unknown, opKind: OutboxKind): OutboxErrorClass => {
    if (error instanceof ApiError) {
        return classifyStatus(error, opKind);
    }
    if (error instanceof OutboxEntryGoneError) {
        return final('deletedRemotely');
    }
    // The interceptor refused the session (no token after a failed refresh, another user's token,
    // a session that changed meanwhile): pending behind the `auth` gate; a resend is idempotent.
    if (error instanceof AuthRequestCancelledError) {
        return { kind: 'auth' };
    }
    // A 2xx whose body was not JSON (the write was probably applied) or a cancelled request: retry.
    if (error instanceof ApiResponseFormatError || isRequestCancelled(error)) {
        return { kind: 'transient' };
    }
    // A request never sent (a client misconfiguration such as a bad API URL) waits like a network
    // error, as before #631: a queued user write is not lost to a bad build.
    return isNetworkError(error) || isRequestNotSent(error)
        ? { kind: 'network' }
        : final('rejected');
};

/** 1 s → 60 s, ±20 %. */
export const backoff = (attempt: number): number =>
    Math.min(1000 * 2 ** attempt, 60_000) * (0.8 + Math.random() * 0.4);

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

// A write the outbox refused (stopped, cleared) is no persistence failure; a write-lock timeout is
// transient and reported on its own, without taking the once-per-session persist-failure report.
export const reportOutboxWriteFailure = (error: unknown): void => {
    if (error instanceof OutboxLockTimeoutError) {
        Sentry.captureMessage('outbox.write_lock_timeout', { level: 'warning' });
    } else if (!(error instanceof OutboxWriteStoppedError)) {
        reportPersistFailed(error);
    }
};

/**
 * Repeats a failed queue write with backoff until it lands (true) or `shouldStop` (false: the op
 * stays queued and the next drain sends it again, idempotent). The request is never repeated. A
 * write refused because the owner's outbox stopped (cleared, another owner) is not repeated.
 */
export const retryWrite = (
    op: OutboxOpBase,
    write: () => Promise<unknown>,
    shouldStop: () => boolean = isOutboxStopped,
    attempt = 0,
): Promise<boolean> =>
    write().then(
        () => true,
        (error: unknown) => {
            if (error instanceof OutboxWriteStoppedError) {
                return false;
            }
            setOutboxStatus(op.opId, 'failed-unsaved');
            reportOutboxWriteFailure(error);
            return sleep(backoff(attempt)).then(() =>
                shouldStop() ? false : retryWrite(op, write, shouldStop, attempt + 1),
            );
        },
    );

// A run outside this tab's current drain session (stopped, restarted, or the owner's data changed:
// another owner, `clearUserData` and back, M2) is stale: it never touches the gate, never claims,
// never sends again, and writes only what its fence still allows.
const isStale = (op: OutboxOpBase, fence: OutboxFence): boolean =>
    !isDrainFence(fence) || op.owner !== outboxOwner();

const skipped = (op: OutboxOpBase, fence: OutboxFence): OutboxResult | null =>
    isStale(op, fence) ? STOPPED : isOpCancelled(op.opId) ? CANCELLED : null;

// Compare-and-clear of the run's own claim; a failure leaves it to the next claim or restore.
const releaseClaim = (op: OutboxOpBase, fence: OutboxFence): Promise<void> =>
    isOwnerFence(fence)
        ? releaseOutboxClaim(op, fence).catch(reportOutboxWriteFailure)
        : Promise.resolve();

const noop = (): void => undefined;

type StartWait = (done: () => void) => () => void;

// A wait for the network or a backoff ends early when the op is discarded or the drain stops
// (§2.5: a cancelled op resolves at the nearest check, without a request); either way the
// subscription and the timer are released.
const waitUnlessSkipped = (op: OutboxOpBase, fence: OutboxFence, start: StartWait): Promise<void> =>
    new Promise(resolve => {
        let settled = false;
        let stopWait = noop;
        let unsubscribe = noop;
        const finish = (): void => {
            if (!settled) {
                settled = true;
                stopWait();
                unsubscribe();
                resolve();
            }
        };

        if (skipped(op, fence)) {
            finish();
            return;
        }
        unsubscribe = onOutboxWake(() => {
            if (skipped(op, fence)) {
                finish();
            }
        });
        stopWait = start(finish);
        if (settled) {
            stopWait();
        }
    });

const online: StartWait = done => {
    if (onlineManager.isOnline()) {
        done();
        return noop;
    }
    return onlineManager.subscribe(isOnline => {
        if (isOnline) {
            done();
        }
    });
};

const timeout =
    (ms: number): StartWait =>
    done => {
        const timer = setTimeout(done, ms);

        return () => clearTimeout(timer);
    };

// Requests (and their removal writes) of this tab in flight: the drain lock is released on hidden
// only once none is (§2.3).
let inFlight = 0;
const idleListeners = new Set<() => void>();

/** Resolves once no request of this tab is in flight. */
export const whenOutboxIdle = (): Promise<void> =>
    inFlight === 0
        ? Promise.resolve()
        : new Promise(resolve => {
              idleListeners.add(resolve);
          });

const endSend = (): void => {
    inFlight -= 1;
    if (inFlight === 0) {
        const listeners = [...idleListeners];

        idleListeners.clear();
        listeners.forEach(listener => listener());
    }
};

const trackSend = <T>(send: Promise<T>): Promise<T> => {
    inFlight += 1;
    return send.finally(endSend);
};

// A 2xx or a no-op answer: our version first, then the slot goes to the next op. The removal
// write (it also clears the claim) needs no turn and keeps retrying after the drain stops, until
// the owner's data changes (03-15a R2: a same-owner answer after a stop is processed). An answer
// for an owner whose data changed meanwhile (M2) writes nothing and resolves `stopped`. Only a
// Retry of a failed op (or a discard) unblocks an entry, never any other success (D29, M4).
const onSent = (
    op: OutboxOpBase,
    sent: OutboxSent,
    isRetry: boolean,
    fence: OutboxFence,
): OutboxResult => {
    if (!isOwnerFence(fence) || op.owner !== outboxOwner()) {
        return STOPPED;
    }
    noteOutboxVersion(op, sent.version);
    markPendingRemoval(op.opId);
    if (isDrainFence(fence)) {
        outboxGate.releaseTurn(op.opId);
    }
    // Counted as in flight: a hidden tab releases the drain lock only once its removal (and the
    // version it keeps) landed, before the next holder clears the claim (R2).
    void trackSend(
        retryWrite(
            op,
            () => removeOutboxOp(op, fence),
            // Until the owner's data changes (a token that is momentarily missing does not stop it).
            () => !isOwnerFence(fence),
        ),
    ).then(landed => {
        if (landed && isRetry && !isStale(op, fence) && hasNoFailureOf(op.entryId)) {
            outboxGate.unblock(op.entryId);
        }
    });
    return { kind: 'sent', entry: sent.entry };
};

// The claim is cleared before a backoff or a gate wait (a discard is allowed meanwhile) and, for a
// final answer, by the failed-list write itself (a discard never races it). A stale run only clears
// its own claim and touches no gate (M2).
const onSendError = async (
    op: OutboxOpBase,
    error: unknown,
    retry: () => Promise<OutboxResult>,
    { attempt, isRetry, fence }: { attempt: number; isRetry: boolean; fence: OutboxFence },
): Promise<OutboxResult> => {
    const errorClass = classifyOutboxError(error, op.kind);

    if (errorClass.kind === 'noop') {
        return onSent(op, NO_OP, isRetry, fence);
    }
    if (isStale(op, fence)) {
        await releaseClaim(op, fence);
        return STOPPED;
    }
    switch (errorClass.kind) {
        case 'network':
        case 'transient':
            await releaseClaim(op, fence);
            if (isStale(op, fence)) {
                return STOPPED;
            }
            setOutboxStatus(
                op.opId,
                errorClass.kind === 'network' ? 'waiting-network' : 'server-unavailable',
            );
            await waitUnlessSkipped(op, fence, timeout(backoff(attempt)));
            return retry();
        case 'auth':
        case 'outdated':
            await releaseClaim(op, fence);
            if (isStale(op, fence)) {
                return STOPPED;
            }
            setOutboxStatus(
                op.opId,
                errorClass.kind === 'auth' ? 'sign-in-required' : 'update-required',
            );
            outboxGate.close(errorClass.kind);
            return retry();
        case 'conflict': {
            // §2.6: the server answered for good, only the write is repeated. Nothing is blocked:
            // the op and the later ops of its entry leave the queue in this write (into the draft).
            const outcome: { conflict?: OutboxConflict } = {};
            const landed = await retryWrite(
                op,
                () =>
                    recordConflict(op, fence).then(conflict => {
                        outcome.conflict = conflict;
                    }),
                () => isStale(op, fence),
            );

            if (!landed || !outcome.conflict) {
                await releaseClaim(op, fence);
                return STOPPED;
            }
            return {
                kind: 'conflicted',
                entry: errorClass.current,
                isDelete: outcome.conflict.isDelete,
            };
        }
        case 'final': {
            // Synchronously, before the write: later ops of this entry are skipped from now on.
            // A resend cannot succeed (the server answered for good, or a client error that is not a
            // request failure, e.g. a mapper error): only the write is repeated, never the request.
            outboxGate.block(op.entryId);
            const landed = await trackFailureWrite(
                op.entryId,
                retryWrite(
                    op,
                    () => recordFailedOp(op, errorClass.reason, fence),
                    () => isStale(op, fence),
                ),
            );

            if (!landed) {
                await releaseClaim(op, fence);
                return STOPPED;
            }
            throw new OutboxTerminalError(errorClass.reason);
        }
    }
};

// The failed ops whose Retry runs in this tab now; cleared when the run settles.
const retryingOpIds = new Set<string>();

export const isOutboxRetrying = (opId: string): boolean => retryingOpIds.has(opId);

const attempt = async <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    ignoreEntryBlock: boolean,
    count: number,
    fence: OutboxFence,
    signal: AbortSignal,
): Promise<OutboxResult> => {
    const retry = (): Promise<OutboxResult> =>
        attempt(op, deps, ignoreEntryBlock, count + 1, fence, signal);
    const isOwnerSession = (): boolean => deps.sessionUserId() === op.owner;

    // M2: a stale run never joins the turn order of a newer drain session.
    if (isStale(op, fence)) {
        return STOPPED;
    }
    await outboxGate.whenTurn(op, {
        ignoreEntryBlock,
        isSkipped: () => skipped(op, fence) !== null,
    });
    await waitUnlessSkipped(op, fence, online);
    const skip = skipped(op, fence);

    if (skip) {
        return skip;
    }
    // C3-07, first check: the in-memory token. The claim repeats it under the write lock (N4) and
    // the interceptor against the token it attaches (`expectedTokenSubject`).
    if (!isOwnerSession()) {
        setOutboxStatus(op.opId, 'sign-in-required');
        outboxGate.close('auth');
        return retry();
    }
    // M1: ordered after a discard whose write is in flight (§2.3: a discard never races a request).
    const claim = await claimOutboxOp(op, fence, isOwnerSession).catch((error: unknown) => {
        reportOutboxWriteFailure(error);
        return 'unsaved' as const;
    });

    switch (claim) {
        case 'unsaved':
            // The claim write was rejected (or its lock timed out): transient, claim again later.
            setOutboxStatus(op.opId, 'failed-unsaved');
            await waitUnlessSkipped(op, fence, timeout(backoff(count)));
            return retry();
        case 'stopped':
            return STOPPED;
        case 'gone':
            return isStale(op, fence) ? STOPPED : CANCELLED;
        case 'auth':
        case 'claimed':
            break;
    }
    // N4: the drain session and the session's owner once more, right before the request.
    if (claim === 'auth' || isStale(op, fence) || !isOwnerSession()) {
        await releaseClaim(op, fence);
        if (isStale(op, fence)) {
            return STOPPED;
        }
        setOutboxStatus(op.opId, 'sign-in-required');
        outboxGate.close('auth');
        return retry();
    }
    inFlight += 1;
    // Still in flight until the answer is processed: a success has started its removal (counted
    // on its own) before the tab may count as idle. `finally`: a throwing send never leaves the
    // count up (03-15c2 R3 N2: every hidden release would wait for the timeout). A send that throws
    // synchronously is classified like a rejected one, so its claim is cleared (R1 N4).
    try {
        const outcome = await Promise.resolve()
            .then(() => deps.send(op, getOutboxVersion(op.entryId), signal))
            .then(
                (sent: OutboxSent) => ({ sent }),
                (error: unknown) => ({ error }),
            );

        return 'sent' in outcome
            ? onSent(op, outcome.sent, ignoreEntryBlock, fence)
            : onSendError(op, outcome.error, retry, {
                  attempt: count,
                  isRetry: ignoreEntryBlock,
                  fence,
              });
    } finally {
        endSend();
    }
};

/**
 * Sends one op when its turn comes, within the drain session it started in (its fence). Resolves
 * with a success, `conflicted` (§2.6, after the draft write), `stopped` or `cancelled`; rejects only
 * with `OutboxTerminalError`, after the op was recorded as failed. A failed op under "Retry"
 * (`retryRequested`) ignores its entry's block.
 */
export const runOutboxOp = <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    { ignoreEntryBlock = isRetryRequested(op.opId) }: { ignoreEntryBlock?: boolean } = {},
): Promise<OutboxResult> => {
    const fence = currentOutboxFence();

    if (ignoreEntryBlock) {
        retryingOpIds.add(op.opId);
    }
    return attempt(op, deps, ignoreEntryBlock, 0, fence, outboxSessionSignal()).finally(() => {
        retryingOpIds.delete(op.opId);
        // A newer session may have adopted the same op: its turn is not this run's to release.
        if (isDrainFence(fence)) {
            outboxGate.releaseTurn(op.opId);
        }
        if (isOpCancelled(op.opId) || isOpCancelledInKey(op.opId)) {
            void forgetCancelled(op.opId, fence).catch(reportOutboxWriteFailure);
        }
    });
};

/**
 * Re-checks the owner (§2.3): the `auth` gate opens only while the token's `sub` is the outbox
 * owner. Called at the restore and on every new access token (`bootstrap`, the interceptor's
 * `onAccessTokenChanged`).
 */
export const recheckOutboxOwner = (sessionUserId: string | null): void => {
    const owner = outboxOwner();

    if (owner !== null && sessionUserId === owner) {
        outboxGate.open('auth');
    } else {
        outboxGate.close('auth');
    }
};

/** §2.8: an op older than this (by `createdAt`) is failed `stale` instead of being sent. */
export const OUTBOX_STALE_MS = 14 * 24 * 60 * 60 * 1000;

const opIdOf = (variables: unknown): unknown =>
    typeof variables === 'object' && variables !== null && 'opId' in variables
        ? variables.opId
        : undefined;

/** The ops with a pending outbox mutation in this tab (settled ones linger until gc). */
export const runningOutboxOpIds = (client: QueryClient): ReadonlySet<unknown> =>
    new Set(
        client
            .getMutationCache()
            .getAll()
            .filter(mutation => mutation.state.status === 'pending')
            .map(mutation => opIdOf(mutation.state.variables)),
    );

/** Whether the op may be sent for its owner (C3-07) and is an expense (C2-02). */
export type OutboxOpCheck = (op: OutboxOpBase) => boolean;

/**
 * Creates the outbox mutations (the only place, §2.1, in the drain-lock holder): each pending op
 * and each failed op under "Retry" not yet running, by `seq`,
 * as a paused mutation without a scope that continues at once (the drain turn orders them). An
 * op of another owner or not an expense moves to failed `unreadable`, an op older than 14 days to
 * failed `stale` (§2.8); skipped: cancelled (in memory or in the key), failed, already sent
 * (`pendingRemovals`) and already running ops (idempotent on a repeated call).
 */
export const adoptOutboxOps = (
    client: QueryClient,
    mutationKeyFor: (kind: OutboxKind) => MutationKey,
    isAcceptable: OutboxOpCheck,
): void => {
    const cache = client.getMutationCache();
    const fence = currentOutboxFence();
    const running = runningOutboxOpIds(client);
    const retries = retryRequestedOps();

    [...pendingOutboxOps(), ...retries].forEach(op => {
        const isRetry = retries.includes(op);

        if (
            isOpCancelled(op.opId) ||
            isOpCancelledInKey(op.opId) ||
            (isOpFailed(op.opId) && !isRetry) ||
            isPendingRemoval(op.opId) ||
            running.has(op.opId)
        ) {
            return;
        }
        const isForeign = op.owner !== outboxOwner() || !isAcceptable(op);

        // A Retry of an op that may not be sent stays failed (it would hold the `auth` gate).
        if (isRetry && isForeign) {
            return;
        }
        const failure = isRetry
            ? null
            : isForeign
              ? 'unreadable'
              : Date.now() - op.createdAt > OUTBOX_STALE_MS
                ? 'stale'
                : null;

        if (failure) {
            outboxGate.block(op.entryId);
            void trackFailureWrite(
                op.entryId,
                retryWrite(op, () => recordFailedOp(op, failure, fence)),
            );
            return;
        }
        outboxGate.adopt(op, isRetry);
        const mutation = cache.build<OutboxResult, Error, OutboxOpBase, unknown>(
            client,
            { mutationKey: mutationKeyFor(op.kind) },
            {
                context: undefined,
                data: undefined,
                error: null,
                failureCount: 0,
                failureReason: null,
                isPaused: true,
                status: 'pending',
                variables: op,
                submittedAt: op.createdAt,
            },
        );

        // Like `resumePausedMutations`: a final error is handled by the defaults' `onError`. A
        // mutation that failed before its run started must not hold the turn of the later ops (L4).
        void mutation.continue().catch(() => {
            // A newer drain session may have adopted the op again: not this session's turn to release.
            if (isDrainFence(fence)) {
                outboxGate.releaseTurn(op.opId);
            }
        });
    });
};

/** What the restore and the adoption need of the outbox's entity (`entities/ledger`). */
export interface OutboxAdoption {
    mutationKeyFor: (kind: OutboxKind) => MutationKey;
    isAcceptable: OutboxOpCheck;
    /** The `sub` of the current access token. */
    sessionUserId: () => string | null;
    /** §2.6: old failed delete `conflict` records dropped by the restore (03-16b R1 L3). */
    onConflictDeletesDropped?: (ops: readonly OutboxOpBase[]) => void;
}

/**
 * The drain-lock acquisition (§1.6, §2.3; `outboxDrain.ts`): a new drain session starts, the
 * `auth` gate is closed, `readOutbox` sets `outboxRestore` (once per owner); only when it is `ok`:
 * one write re-reads the keys and clears a stale `sending` claim of a previous holder (no other
 * tab sends while this one holds the lock) and moves the unreadable ops to failed, the versions are restored, every
 * entry with a failed op is blocked, the ops are adopted as paused mutations (by `seq`, skipping
 * cancelled, failed, pending-removal and running ops), the outbox entries are invalidated (§1.4)
 * and the `auth` gate opens if the token's `sub` is the owner. The defaults of the outbox keys
 * must be registered before. Idempotent per op (a repeated call adopts nothing twice). Never
 * rejects.
 */
export const restoreOutbox = (
    client: QueryClient,
    userId: string,
    adoption: OutboxAdoption,
): Promise<OutboxRestore> => {
    startOutbox(userId);
    outboxGate.close('auth');
    return readOutbox(userId).then(result => {
        if (result !== 'ok' || outboxOwner() !== userId) {
            return result;
        }
        // The clear write re-reads the keys; when it fails they are read once more (L5).
        // 03-16b: the interim failed `conflict` records of older builds become conflict drafts.
        return writeOutbox(draft => {
            draft.sending = null;
            return convertFailedConflicts(draft);
        })
            .then(
                dropped => {
                    // R2-N2: a throwing listener never fails the restore.
                    try {
                        if (dropped.length > 0) {
                            adoption.onConflictDeletesDropped?.(dropped);
                        }
                    } catch (error: unknown) {
                        Sentry.captureException(error);
                    }
                },
                (error: unknown) => {
                    reportOutboxWriteFailure(error);
                    return refreshOutbox();
                },
            )
            .then(() => {
                if (outboxOwner() !== userId || isOutboxStopped()) {
                    return result;
                }
                restoreOutboxVersions();
                failedEntryIds().forEach(entryId => outboxGate.block(entryId));
                adoptOutboxOps(client, adoption.mutationKeyFor, adoption.isAcceptable);
                // The persisted cache and the outbox are written independently: the server decides.
                outboxEntryIds().forEach(entryId => {
                    void client.invalidateQueries({ queryKey: ledgerEntryKey(entryId) });
                });
                recheckOutboxOwner(adoption.sessionUserId());
                return result;
            });
    });
};
