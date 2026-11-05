// The TanStack Query client (spec 03 §1.2). 03-5: no persistence yet; the persister, the
// `PERSIST_MAX_AGE` gcTime, `registerMutationDefaults` and the per-user client arrive in 03-7a,
// 03-15a and 03-7b.
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from 'shared/lib/apiError';

const MAX_NETWORK_RETRIES = 3;
const MAX_SERVER_RETRIES = 2;

/**
 * Retry policy of every query: a network error (no HTTP response) up to 3 attempts; 5xx and
 * 409 `SYSTEM.CONFLICT` up to 2 (the default TanStack backoff); any other 4xx is final.
 */
export const queryRetry = (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError) {
        if (error.status >= 500 || (error.status === 409 && error.code === 'SYSTEM.CONFLICT')) {
            return failureCount < MAX_SERVER_RETRIES;
        }
        return false;
    }
    // TODO(03-7a): `!isNetworkUsable() || failureCount < 3` once shared/offline/network.ts exists.
    return failureCount < MAX_NETWORK_RETRIES;
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
