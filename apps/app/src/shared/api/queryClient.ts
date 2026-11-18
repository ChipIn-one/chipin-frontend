// The TanStack Query client (spec 03 §1.2). The per-user client and its persister live in
// `shared/offline/restore.ts` (03-7a); `registerMutationDefaults` arrives in 03-15a.
import { isServer, QueryClient } from '@tanstack/react-query';

import { DAY } from 'constants/time';
import { ApiError } from 'shared/lib/apiError';
import { isNetworkUsable } from 'shared/offline/network';

import { isNetworkError } from './client';

// TanStack calls `retry(failureCount, error)` after a failed attempt, `failureCount` from 0:
// `failureCount < n` allows n retries, n + 1 attempts in all.
const NETWORK_RETRIES = 3;
const SERVER_RETRIES = 2;

/** How long a persisted cache is restored (spec 03 §1.4); `gcTime` must not be shorter. */
export const PERSIST_MAX_AGE = 14 * DAY;

/**
 * Retry policy of every query: a network error (no HTTP response, not a cancellation) gets 3
 * retries (4 attempts, ~7 s of default backoff), unlimited while the network is not usable;
 * 5xx and 409 `SYSTEM.CONFLICT` get 2 retries (3 attempts, ~3 s). Everything else is final: other 4xx, a non-JSON 2xx
 * (`ApiResponseFormatError`), an invalid path segment, a mapper error, a cancelled auth request.
 */
export const queryRetry = (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError) {
        return error.status >= 500 || (error.status === 409 && error.code === 'SYSTEM.CONFLICT')
            ? failureCount < SERVER_RETRIES
            : false;
    }
    if (isNetworkError(error)) {
        // Offline the retries do not count down: `offlineFirst` pauses them until reconnect.
        return !isNetworkUsable() || failureCount < NETWORK_RETRIES;
    }
    return false;
};

/**
 * When this page loaded: an entry whose data is older was restored from the persisted cache, not
 * read in this page.
 */
export const PAGE_LOADED_AT = Date.now();

/**
 * `refetchOnMount` of a query that shows balances, debts or ledger amounts (#724): the persisted
 * cache is saved throttled, so a reload right after a money write can restore a snapshot taken
 * before it, and its age alone would count it as fresh. An entry restored from before this page
 * loaded is read again on mount (still shown meanwhile; offline the read waits for the network);
 * an entry read in this page follows its `staleTime`. An entry dated in the future (the clock was
 * moved back) cannot be trusted either and is read again.
 *
 * Limits: TanStack applies this only to a query enabled when it mounts; one mounted disabled and
 * enabled later is judged by its `staleTime` alone. A restored entry whose read fails stays
 * restored, so every later mount reads it again until a read succeeds (one read, with its
 * retries, per mount; paused offline).
 */
export const refetchIfRestored = (query: {
    state: { dataUpdatedAt: number };
}): boolean | 'always' => {
    const { dataUpdatedAt } = query.state;

    return dataUpdatedAt < PAGE_LOADED_AT || dataUpdatedAt > Date.now() ? 'always' : true;
};

/** A new client: one per user (`clientFor`), or one without persistence when signed out. */
export const createQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            queries: {
                networkMode: 'offlineFirst',
                staleTime: 30_000,
                // >= maxAge, otherwise an inactive query is collected before it is persisted. On the
                // server (landing prerender) Infinity: no 14-day GC timer keeps Node alive.
                gcTime: isServer ? Infinity : PERSIST_MAX_AGE,
                retry: queryRetry,
                refetchOnWindowFocus: true,
                refetchOnReconnect: true,
            },
            mutations: { networkMode: 'offlineFirst', retry: false },
        },
    });
