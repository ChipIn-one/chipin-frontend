// Deletes everything of one user on this device (spec 03 §1.5): called only for a sign-out (this
// tab or remote) and an account switch, never for an expiry or an error.
import * as Sentry from '@sentry/react';
import { del } from 'idb-keyval';

import { queryCacheKey } from './constants';
import { deleteOutboxKeys, stopOutboxIo } from './outboxIo';
import {
    blockCacheWrites,
    cachesByUser,
    claimPersistFailureReport,
    takePendingSeed,
} from './userCaches';

const errorName = (error: unknown): string =>
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
        ? error.name
        : typeof error;

/**
 * Steps (1), (2), (2a) and (4) of §1.5, synchronous: (1) stop saving the user's query cache and stop
 * the user's outbox (its drain and every later outbox write; `stopOutboxIo` also releases the drain
 * lock, stops requesting it and closes the outbox channel, `outboxDrain.ts`); (2) clear the user's
 * QueryClient; (2a) `resetUserStores`, the legacy zustand stores and the expense draft (they live
 * in `store`, so the caller passes them); (4) forget the user's client, so the provider and the next
 * sign-in get a new one. Nothing of the user stays in this tab's memory; the IndexedDB keys stay
 * (`deleteUserKeys`). Alone it is the refresh switch that keeps an unsent outbox (03-16a part C).
 */
export const detachUserData = (userId: string, resetUserStores: () => void): void => {
    const entry = cachesByUser.get(userId);

    // (1)
    blockCacheWrites(queryCacheKey(userId));
    stopOutboxIo(userId);
    if (entry) {
        entry.disposed = true;
        entry.unsubscribe?.();
        entry.unsubscribe = null;
        // (2)
        entry.client.clear();
    }
    // (2a)
    resetUserStores();
    // (4) A seed still waiting for the client is the user's data too.
    cachesByUser.delete(userId);
    takePendingSeed(userId);
};

/**
 * Step (3) of §1.5: deletes the user's IndexedDB keys (the outbox keys under the user's write lock,
 * after the outbox write already running, so none lands after the `del`). Run after
 * `detachUserData` (no write of the user starts any more). Settles when the keys are deleted and
 * never rejects (an IDB error is reported once per session, the app goes on).
 */
export const deleteUserKeys = (userId: string): Promise<void> =>
    // A synchronous IDB error (no `indexedDB`) becomes a rejection too.
    Promise.resolve()
        .then(() => Promise.all([del(queryCacheKey(userId)), deleteOutboxKeys(userId)]))
        .then(
            () => undefined,
            (error: unknown) => {
                if (!claimPersistFailureReport()) {
                    return;
                }
                Sentry.captureMessage('offline.persist_failed', {
                    level: 'warning',
                    tags: { 'offline.error': errorName(error) },
                });
            },
        );

/**
 * Deletes everything of one user on this device, strictly in the order of §1.5, otherwise a
 * throttled write (1 s) or a cache event after the `del` brings the user's data back:
 * `detachUserData` (steps 1, 2, 2a, 4, synchronous), then `deleteUserKeys` (step 3). Callers do not
 * wait for the deletes (a hanging IDB must not hold a sign-in or a sign-out).
 */
export const clearUserData = (userId: string, resetUserStores: () => void): Promise<void> => {
    detachUserData(userId, resetUserStores);
    return deleteUserKeys(userId);
};
