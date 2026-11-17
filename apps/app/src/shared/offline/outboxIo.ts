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

// The lock spans the whole IO (a read-modify-write of both keys) and nothing else: never a request.
const underWriteLock = <T>(userId: string, io: () => Promise<T>): Promise<T> => {
    if (!hasWebLocks()) {
        return io();
    }
    let started = false;

    return navigator.locks
        .request(
            outboxWriteLockName(userId),
            { signal: AbortSignal.timeout(OUTBOX_WRITE_LOCK_TIMEOUT_MS) },
            () => {
                started = true;
                return io();
            },
        )
        .then(
            (result: Promise<T>) => result,
            (error: unknown) => {
                throw started ? error : new OutboxLockTimeoutError();
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

/**
 * Runs `io` after every earlier outbox IO of this tab, under the user's write lock; a cleared
 * user's IO is refused (checked once the lock is held).
 */
export const runOutboxIo = <T>(userId: string, io: () => Promise<T>): Promise<T> =>
    enqueue(() =>
        underWriteLock(userId, () =>
            disposedUsers.has(userId) ? Promise.reject(new OutboxWriteStoppedError()) : io(),
        ),
    );

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

/**
 * `clearUserData` step (3): deletes the user's outbox keys under the write lock, once the IO already
 * running has settled (from step (1) on no new IO of the user starts), so no write of it lands after
 * the `del`. Not part of the chain itself: a hanging delete never holds later outbox IO.
 */
export const deleteOutboxKeys = (userId: string): Promise<void> => {
    const deleteKeys = (): Promise<void> =>
        Promise.all(outboxKeys(userId).map(key => del(key))).then(() => undefined);
    // Flag off no outbox runs anywhere: the keys are deleted without a lock, as before 03-15c1.
    const remove = (): Promise<void> =>
        isOfflineWritesFlagOn() ? underWriteLock(userId, deleteKeys) : deleteKeys();

    return running === 0 ? start(remove) : tail.then(remove);
};
