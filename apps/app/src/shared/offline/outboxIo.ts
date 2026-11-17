// The order of every IndexedDB access to the outbox keys (spec 03 §2.3): one promise chain in this
// tab, and each IO runs under the write lock `chipin-outbox-write:<userId>` (`navigator.locks`,
// 03-15c1), so a read-modify-write never interleaves with another one, in this tab or another,
// nor with the deletion of `clearUserData`. Without Web Locks only this tab's chain orders the IO
// (offline writing is then off, §2.3). It imports no schema or persister code: `clearUserData`, on
// the landing path, uses it.
import { del } from 'idb-keyval';

import { outboxKeys } from './constants';
import { isOfflineWritesFlagOn } from './offlineWrites';

/** The outbox of this user may not be written now (cleared, not restored, or another owner). */
export class OutboxWriteStoppedError extends Error {
    override readonly name = 'OutboxWriteStoppedError';

    constructor() {
        super('Outbox writes are stopped');
    }
}

/** The write lock was not granted within `OUTBOX_WRITE_LOCK_TIMEOUT_MS`: nothing was read or written. */
export class OutboxLockTimeoutError extends Error {
    override readonly name = 'OutboxLockTimeoutError';

    constructor() {
        super('The outbox write lock timed out');
    }
}

/** §2.3: a write waits at most this long for the write lock. */
export const OUTBOX_WRITE_LOCK_TIMEOUT_MS = 5000;

export const outboxWriteLockName = (userId: string): string => `chipin-outbox-write:${userId}`;

/** Web Locks are available: without them offline writing is off (§2.3, §2.7). */
export const hasWebLocks = (): boolean =>
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof navigator.locks.request === 'function';

// A signal aborted after the lock timeout. `AbortSignal.timeout` is missing in older browsers
// (Safari before 16): an `AbortController` and a timer instead.
const lockTimeoutSignal = (): { signal: AbortSignal; clear: () => void } => {
    if (typeof Reflect.get(AbortSignal, 'timeout') === 'function') {
        return {
            signal: AbortSignal.timeout(OUTBOX_WRITE_LOCK_TIMEOUT_MS),
            clear: () => undefined,
        };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new DOMException('The outbox write lock timed out', 'TimeoutError'));
    }, OUTBOX_WRITE_LOCK_TIMEOUT_MS);

    return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

// The lock spans the whole IO (a read-modify-write of both keys) and nothing else: never a request.
// Only a request the timeout aborted is a lock timeout; any other refusal keeps its error.
const underWriteLock = <T>(userId: string, io: () => Promise<T>): Promise<T> => {
    if (!hasWebLocks()) {
        return io();
    }
    const { signal, clear } = lockTimeoutSignal();
    let started = false;

    return navigator.locks
        .request(outboxWriteLockName(userId), { signal }, () => {
            started = true;
            clear();
            return io();
        })
        .then(
            (result: Promise<T>) => result,
            (error: unknown) => {
                clear();
                throw !started && signal.aborted ? new OutboxLockTimeoutError() : error;
            },
        );
};

let tail: Promise<unknown> = Promise.resolve();
let running = 0;
// Users whose data `clearUserData` deleted: none of their outbox IO runs until their outbox starts again.
const disposedUsers = new Set<string>();
const disposeListeners = new Set<(userId: string) => void>();

const start = <T>(io: () => Promise<T>): Promise<T> => {
    try {
        return io();
    } catch (error: unknown) {
        return Promise.reject(error);
    }
};

// With no IO running, `io` starts at once (a `clearUserData` deletes as early as before 03-15b).
const enqueue = <T>(io: () => Promise<T>): Promise<T> => {
    const run = running === 0 ? start(io) : tail.then(io);

    running += 1;
    // The caller gets `run` with its error; the chain only waits for it to settle.
    tail = run
        .catch(() => undefined)
        .then(() => {
            running -= 1;
        });
    return run;
};

const refuseDisposed = <T>(userId: string, io: () => Promise<T>): Promise<T> =>
    disposedUsers.has(userId) ? Promise.reject(new OutboxWriteStoppedError()) : io();

// The `clearUserData` delete of each user still running (it may retry after a lock timeout): the
// user's next outbox session reads and writes only after it, never into keys it then deletes.
const pendingDeletes = new Map<string, Promise<void>>();

/**
 * Runs `io` after every earlier outbox IO of this tab and after the user's pending delete, under the
 * user's write lock; a cleared user's IO is refused before the lock is requested and again once it is
 * held. Another user's IO does not wait for the delete.
 */
export const runOutboxIo = <T>(userId: string, io: () => Promise<T>): Promise<T> => {
    const run = (): Promise<T> =>
        enqueue(() =>
            refuseDisposed(userId, () => underWriteLock(userId, () => refuseDisposed(userId, io))),
        );
    const deleting = pendingDeletes.get(userId);

    return deleting ? deleting.then(run) : run();
};

/** The user's outbox starts again (a sign-in after a sign-out): their IO runs again. */
export const reviveOutboxIo = (userId: string): void => {
    disposedUsers.delete(userId);
};

/** Called when `clearUserData` stops a user's outbox (the store stops its drain). */
export const onOutboxDisposed = (listener: (userId: string) => void): (() => void) => {
    disposeListeners.add(listener);
    return () => {
        disposeListeners.delete(listener);
    };
};

/** `clearUserData` step (1): no outbox IO of the user runs from now on, the drain stops. */
export const stopOutboxIo = (userId: string): void => {
    disposedUsers.add(userId);
    disposeListeners.forEach(listener => listener(userId));
};

/** A delete whose write lock timed out is tried this many times, then done without the lock. */
export const OUTBOX_DELETE_LOCK_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

/**
 * `clearUserData` step (3): deletes the user's outbox keys under the write lock, once the IO already
 * running has settled (from step (1) on no new IO of the user starts), so no write of it lands after
 * the `del`. A lock timeout (another tab holds the lock) is retried with a backoff; after
 * `OUTBOX_DELETE_LOCK_ATTEMPTS` timeouts the keys are deleted without the lock (this tab's IO of the
 * user is refused already): the user's data must not survive a sign-out. Not part of the chain
 * itself: a hanging delete never holds later outbox IO.
 */
export const deleteOutboxKeys = (userId: string): Promise<void> => {
    const deleteKeys = (): Promise<void> =>
        Promise.all(outboxKeys(userId).map(key => del(key))).then(() => undefined);
    const lockedDelete = (attempt: number): Promise<void> =>
        underWriteLock(userId, deleteKeys).catch((error: unknown) => {
            if (!(error instanceof OutboxLockTimeoutError)) {
                throw error;
            }
            return attempt + 1 >= OUTBOX_DELETE_LOCK_ATTEMPTS
                ? deleteKeys()
                : sleep(250 * 2 ** attempt).then(() => lockedDelete(attempt + 1));
        });
    // Flag off no outbox runs anywhere: the keys are deleted without a lock, as before 03-15c1.
    const remove = (): Promise<void> => (isOfflineWritesFlagOn() ? lockedDelete(0) : deleteKeys());
    const deleting = running === 0 ? start(remove) : tail.then(remove);
    const settled: Promise<void> = deleting.then(
        () => undefined,
        () => undefined,
    );

    // A second clear of the user while the first delete still retries: the session waits for both.
    const previous = pendingDeletes.get(userId);
    const current = previous ? Promise.all([previous, settled]).then(() => undefined) : settled;

    pendingDeletes.set(userId, current);
    void current.then(() => {
        if (pendingDeletes.get(userId) === current) {
            pendingDeletes.delete(userId);
        }
    });
    return deleting;
};
