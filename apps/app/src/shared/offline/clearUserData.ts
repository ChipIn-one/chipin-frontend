// Deletes everything of one user on this device (spec 03 §1.5): called only for a sign-out (this
// tab or remote) and an account switch, never for an expiry or an error.
import * as Sentry from '@sentry/react';
import { del } from 'idb-keyval';

import { outboxKeys, queryCacheKey } from './constants';
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
 * Strictly in the order of §1.5, otherwise a throttled write (1 s) or a cache event after the `del`
 * brings the user's data back: (1) stop saving the query cache (the outbox subscriber and the leader
 * lock join here from 03-15a/03-15c); (2) clear the user's QueryClient; (2a) `resetUserStores`, the
 * legacy zustand stores and the expense draft (they live in `store`, so the caller passes them);
 * (3) delete the user's IndexedDB keys; (4) forget the user's client, so the provider and the next
 * sign-in get a new one. Steps 1–2a and 4 are synchronous; callers do not wait for the deletes (a
 * hanging IDB must not hold a sign-in or a sign-out). The promise settles when the keys are deleted
 * and never rejects (an IDB error is reported once per session, the app goes on).
 */
export const clearUserData = (userId: string, resetUserStores: () => void): Promise<void> => {
    const entry = cachesByUser.get(userId);
    const cacheKey = queryCacheKey(userId);
    const keys = [cacheKey, ...outboxKeys(userId)];

    // (1)
    blockCacheWrites(cacheKey);
    if (entry) {
        entry.disposed = true;
        entry.unsubscribe?.();
        entry.unsubscribe = null;
        // (2)
        entry.client.clear();
    }
    // (2a)
    resetUserStores();
    // (3)
    // A synchronous IDB error (no `indexedDB`) becomes a rejection too.
    const deleted = Promise.resolve()
        .then(() => Promise.all(keys.map(key => del(key))))
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
    // (4) A seed still waiting for the client is the user's data too.
    cachesByUser.delete(userId);
    takePendingSeed(userId);

    return deleted;
};
