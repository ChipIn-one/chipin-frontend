// The order of every IndexedDB access to the outbox keys in this tab (spec 03 §2.3, 03-15b): one
// promise chain, so a read-modify-write never interleaves with another one or with the deletion of
// `clearUserData`. 03-15c wraps the same `runOutboxIo` in the write lock (`navigator.locks`). It
// imports no schema or persister code: `clearUserData`, on the landing path, uses it.
import { del } from 'idb-keyval';

import { outboxKeys } from './constants';

/** The outbox of this user may not be written now (cleared, not restored, or another owner). */
export class OutboxWriteStoppedError extends Error {
    override readonly name = 'OutboxWriteStoppedError';

    constructor() {
        super('Outbox writes are stopped');
    }
}

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

/** Runs `io` after every earlier outbox IO of this tab; a cleared user's IO is refused. */
export const runOutboxIo = <T>(userId: string, io: () => Promise<T>): Promise<T> =>
    enqueue(() =>
        disposedUsers.has(userId) ? Promise.reject(new OutboxWriteStoppedError()) : io(),
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
 * `clearUserData` step (3): deletes the user's outbox keys once the IO already running has settled
 * (from step (1) on no new IO of the user starts), so no write of it lands after the `del`. Not part
 * of the chain itself: a hanging delete never holds later outbox IO.
 */
export const deleteOutboxKeys = (userId: string): Promise<void> => {
    const remove = (): Promise<void> =>
        Promise.all(outboxKeys(userId).map(key => del(key))).then(() => undefined);

    return running === 0 ? start(remove) : tail.then(remove);
};
