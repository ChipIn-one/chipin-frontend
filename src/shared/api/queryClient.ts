// The TanStack Query client (spec 03 §1.2). 03-5: no persistence yet; the persister, the
// `PERSIST_MAX_AGE` gcTime, `registerMutationDefaults` and the per-user client arrive in 03-7a,
// 03-15a and 03-7b.
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from 'shared/lib/apiError';

import { isNetworkError } from './client';

// TanStack calls `retry(failureCount, error)` after a failed attempt, `failureCount` from 0:
// `failureCount < n` allows n retries, n + 1 attempts in all.
const NETWORK_RETRIES = 3;
const SERVER_RETRIES = 2;

/**
 * Retry policy of every query: a network error (no HTTP response, not a cancellation) gets 3
 * retries (4 attempts, ~7 s of default backoff); 5xx and 409 `SYSTEM.CONFLICT` get 2 retries
 * (3 attempts, ~3 s). Everything else is final: other 4xx, a non-JSON 2xx
 * (`ApiResponseFormatError`), an invalid path segment, a mapper error, a cancelled auth request.
 */
export const queryRetry = (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError) {
        return error.status >= 500 || (error.status === 409 && error.code === 'SYSTEM.CONFLICT')
            ? failureCount < SERVER_RETRIES
            : false;
    }
    if (isNetworkError(error)) {
        // TODO(03-7a): `!isNetworkUsable() || failureCount < 3` once shared/offline/network.ts exists.
        return failureCount < NETWORK_RETRIES;
    }
    return false;
};

/** A new client for one app instance (03-7b: one client per user). */
export const createQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            queries: {
                networkMode: 'offlineFirst',
                staleTime: 30_000,
                retry: queryRetry,
                refetchOnWindowFocus: true,
                refetchOnReconnect: true,
            },
            mutations: { networkMode: 'offlineFirst', retry: false },
        },
    });
