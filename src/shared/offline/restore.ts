// The hydration gate (spec 03 §1.5, §1.6): one QueryClient per user, its cache restored from IDB
// outside React before the router renders, then subscribed for saving. Not part of it: the outbox
// (restored separately by the leader, 03-15b) and the offline cold start (`useCheckSignIn`).
import { useCallback, useSyncExternalStore } from 'react';
import * as Sentry from '@sentry/react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import {
    persistQueryClientRestore,
    persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';

import { createQueryClient } from 'shared/api/queryClient';

import { queryCacheKey } from './constants';
import { persistOptions, reportPersistFailed } from './queryPersister';
import { cachesByUser, takePendingSeed, unblockCacheWrites, type UserCache } from './userCaches';

/** After this the app starts without the cache; a late IDB result is not applied. */
export const RESTORE_TIMEOUT_MS = 3000;

const cachesByClient = new WeakMap<QueryClient, UserCache>();

const restoreAndSubscribe = (entry: UserCache, userId: string): Promise<void> => {
    const options = persistOptions(userId);
    // Set on timeout: the restore still runs to the end (and then subscribes), but its data is
    // dropped, otherwise it would overwrite what was loaded after startup.
    let restoreAborted = false;
    const persister: Persister = {
        ...options.persister,
        restoreClient: () =>
            Promise.resolve(options.persister.restoreClient()).then(client =>
                restoreAborted ? undefined : client,
            ),
    };
    let timer: ReturnType<typeof setTimeout> | undefined;

    const restored = persistQueryClientRestore({
        queryClient: entry.client,
        persister,
        maxAge: options.maxAge,
        buster: options.buster,
    })
        // IDB or deserialize error: the restore has already dropped the key; start empty.
        .catch(reportPersistFailed)
        .then(() => {
            clearTimeout(timer);
            if (entry.disposed) {
                // `clearUserData` ran during the restore: nothing of this user is saved again.
                return;
            }
            entry.unsubscribe = persistQueryClientSubscribe({
                queryClient: entry.client,
                persister: options.persister,
                buster: options.buster,
                dehydrateOptions: options.dehydrateOptions,
            });
        })
        .catch(reportPersistFailed);
    const timedOut = new Promise<void>(resolve => {
        timer = setTimeout(() => {
            restoreAborted = true;
            Sentry.captureMessage('offline.restore_timeout', { level: 'warning' });
            resolve();
        }, RESTORE_TIMEOUT_MS);
    });

    return Promise.race([restored, timedOut]);
};

const ensureUserCache = (userId: string): UserCache => {
    const existing = cachesByUser.get(userId);

    if (existing) {
        return existing;
    }
    const entry: UserCache = {
        client: createQueryClient(),
        ready: Promise.resolve(),
        isReady: false,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    };

    // A cleared user signs in again: their new cache is saved.
    unblockCacheWrites(queryCacheKey(userId));
    cachesByUser.set(userId, entry);
    cachesByClient.set(entry.client, entry);
    takePendingSeed(userId)?.(entry.client);
    entry.ready = restoreAndSubscribe(entry, userId).then(() => {
        entry.isReady = true;
        entry.listeners.forEach(listener => listener());
    });
    return entry;
};

/**
 * Restores the user's cache, then subscribes it for saving. Idempotent per user. Resolves on
 * success, after `RESTORE_TIMEOUT_MS`, or on an IDB/deserialize error; never rejects.
 */
export const bootstrapUserCache = (userId: string): Promise<void> => ensureUserCache(userId).ready;

/** The user's QueryClient (memoized): two users never share one. Starts its restore if needed. */
export const clientFor = (userId: string): QueryClient => ensureUserCache(userId).client;

let resolveRestoreReady: () => void = () => undefined;

/**
 * The startup restore of the query cache (§1.6): loaders (spec 04) chain on it. Resolved by
 * `startCacheRestore`; never rejects.
 */
export const restoreReady = new Promise<void>(resolve => {
    resolveRestoreReady = resolve;
});

/** Called once at startup, before the router renders: no user → nothing to restore. */
export const startCacheRestore = (userId: string | undefined): void => {
    if (!userId) {
        resolveRestoreReady();
        return;
    }
    void bootstrapUserCache(userId).then(resolveRestoreReady);
};

const noopUnsubscribe = (): void => undefined;

/**
 * Whether the cache of the client in context is restored: the app renders its shell (header and
 * skeleton) until then. A client without persistence is always ready.
 */
export const useRestoreReady = (): boolean => {
    const entry = cachesByClient.get(useQueryClient());
    const subscribe = useCallback(
        (listener: () => void) => {
            if (!entry) {
                return noopUnsubscribe;
            }
            entry.listeners.add(listener);
            return () => {
                entry.listeners.delete(listener);
            };
        },
        [entry],
    );

    return useSyncExternalStore(
        subscribe,
        () => entry?.isReady ?? true,
        () => true,
    );
};
