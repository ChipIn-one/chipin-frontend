// The per-user query cache persister (spec 03 §1.2, §1.4): IndexedDB through idb-keyval, one
// string key per user, values written by `persistCodec`.
import * as Sentry from '@sentry/react';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { DehydratedState, DehydrateOptions } from '@tanstack/react-query';
import type {
    AsyncStorage,
    PersistedClient,
    Persister,
} from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { z } from 'zod';

import { PERSIST_MAX_AGE } from 'shared/api/queryClient';
import { ApiError } from 'shared/lib/apiError';

import { QUERY_CACHE_EPOCH, queryCacheKey } from './constants';
import { MODEL_SHAPE_HASH } from './modelHash.generated';
import { isEntryWithPendingOp } from './pendingOps';
import { persistCodec } from './persistCodec';
import {
    claimPersistFailureReport,
    isCacheWriteAllowed,
    resetPersistFailureFlag,
} from './userCaches';

/** The single definition of the buster (C2-07): a model shape change resets the cache by itself. */
export const QUERY_CACHE_BUSTER = `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`;

const idbStringStorage: AsyncStorage<string> = {
    getItem: key => get<string>(key).then(value => (typeof value === 'string' ? value : null)),
    // A key cleared by `clearUserData` takes no late (throttled) write until its user is back, and
    // only the shared cached user's key is written (another tab may have switched the account).
    setItem: (key, value) => (isCacheWriteAllowed(key) ? set(key, value) : Promise.resolve()),
    removeItem: key => del(key),
};

/** Tests only: forget that this session already reported a persist failure. */
export const resetPersistFailureReport = (): void => {
    resetPersistFailureFlag();
};

// `DOMException` (the IDB errors) is not an `Error` in every realm: read its `name` directly.
const errorName = (error: unknown): string =>
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
        ? error.name
        : typeof error;

/**
 * An IndexedDB or codec error (Safari private mode, quota, a malformed entry): reported to Sentry
 * once per session, the app keeps working without persistence. Only the error name is sent.
 */
export const reportPersistFailed = (error: unknown): void => {
    if (!claimPersistFailureReport()) {
        return;
    }
    Sentry.captureMessage('offline.persist_failed', {
        level: 'warning',
        tags: { 'offline.error': errorName(error) },
    });
};

const isInfiniteData = (data: unknown): data is { pages: unknown[]; pageParams: unknown[] } =>
    typeof data === 'object' &&
    data !== null &&
    'pages' in data &&
    'pageParams' in data &&
    Array.isArray(data.pages) &&
    Array.isArray(data.pageParams);

/** Infinite queries are persisted with their first page only, otherwise the cache grows forever. */
export const trimInfinitePages = (client: PersistedClient): PersistedClient => ({
    ...client,
    clientState: {
        ...client.clientState,
        queries: client.clientState.queries.map(query => {
            const { data } = query.state;

            return isInfiniteData(data)
                ? {
                      ...query,
                      state: {
                          ...query.state,
                          data: {
                              pages: data.pages.slice(0, 1),
                              pageParams: data.pageParams.slice(0, 1),
                          },
                      },
                  }
                : query;
        }),
    },
});

type DehydratedQueryState = DehydratedState['queries'][number]['state'];

/**
 * The stored copy of every query carries no error and no fetch state: a success with a failed
 * attempt waiting to retry keeps its `fetchFailureReason`, and an `AxiosError` serializes its
 * request config (the `Authorization` header), so no error object ever reaches IndexedDB. An entry
 * kept with data after a failed refetch or next page is persisted as its last success: `hydrate`
 * restores the state as dehydrated, and an `error` status would come back as an error. The data
 * keeps its age and invalidation; the fetch-more direction (`fetchMeta`) is dropped.
 */
const withoutErrors = (state: DehydratedQueryState): DehydratedQueryState => ({
    ...state,
    status: state.status === 'error' ? 'success' : state.status,
    error: null,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
});

const persistWithoutErrors = (client: PersistedClient): PersistedClient => ({
    ...client,
    clientState: {
        ...client.clientState,
        queries: client.clientState.queries.map(query => ({
            ...query,
            state: withoutErrors(query.state),
        })),
    },
});

/** `dehydrateOptions` has no data hook, so the trimming and the error removal wrap the persister. */
export const trimmingPersister = (base: Persister): Persister => ({
    ...base,
    persistClient: client => base.persistClient(trimInfinitePages(persistWithoutErrors(client))),
});

// The persisted envelope is checked on read (invariant 6); the dehydrated entries themselves are
// guarded by the buster (spec 03 §1.4: the deviation from D4 "zod on the IDB cache").
const isDehydratedState = (value: unknown): value is DehydratedState =>
    typeof value === 'object' &&
    value !== null &&
    'queries' in value &&
    'mutations' in value &&
    Array.isArray(value.queries) &&
    Array.isArray(value.mutations);

const PersistedClientSchema = z.object({
    timestamp: z.number(),
    buster: z.string(),
    clientState: z.custom<DehydratedState>(isDehydratedState),
});

/** Parses a stored string; a malformed one throws, and the restore drops the key. */
export const deserializePersistedClient = (text: string): PersistedClient =>
    PersistedClientSchema.parse(persistCodec.parse(text));

// The statuses by which the server rejects the data (a group detail 403/404 wins over the cached
// group, spec 03 §6 row 4, 03-10b): such an entry is not brought back on a reload. A transient 4xx
// (408, 429, a 409 `SYSTEM.CONFLICT`, see `queryRetry`) keeps the data, as a 5xx does.
const DATA_REJECTED_STATUSES: ReadonlySet<number> = new Set([401, 403, 404, 410]);

const isDataRejected = (error: unknown): boolean =>
    error instanceof ApiError && DATA_REJECTED_STATUSES.has(error.status);

// A success, or an error that kept data (a failed refetch or next page: a network error, a 5xx, a
// timeout, a transient 4xx), which `trimmingPersister` writes as the last success; a rejection of
// the data drops it.
const hasPersistableData = (state: { status: string; data: unknown; error: unknown }): boolean =>
    state.status === 'success' ||
    (state.status === 'error' && state.data !== undefined && !isDataRejected(state.error));

export const dehydrateOptions: DehydrateOptions = {
    shouldDehydrateQuery: query =>
        hasPersistableData(query.state) &&
        query.meta?.persist !== false &&
        // An optimistic entry is not persisted (§2.2).
        !isEntryWithPendingOp(query.queryKey),
    // Mutations are persisted by the outbox (§2.3), never with the query cache.
    shouldDehydrateMutation: () => false,
};

export interface PersistOptions {
    persister: Persister;
    maxAge: number;
    buster: string;
    dehydrateOptions: DehydrateOptions;
}

const createPersistOptions = (userId: string): PersistOptions => ({
    persister: trimmingPersister(
        createAsyncStoragePersister({
            key: queryCacheKey(userId),
            throttleTime: 1000,
            storage: idbStringStorage,
            serialize: persistCodec.stringify,
            deserialize: deserializePersistedClient,
            // Without `retry` a serialize/setItem error is silently lost inside the persister.
            retry: ({ error }) => {
                reportPersistFailed(error);
                return undefined;
            },
        }),
    ),
    maxAge: PERSIST_MAX_AGE,
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions,
});

const optionsByUser = new Map<string, PersistOptions>();

/** Memoized by user: a new persister object would mean a repeated restore. */
export const persistOptions = (userId: string): PersistOptions => {
    const existing = optionsByUser.get(userId);

    if (existing) {
        return existing;
    }
    const created = createPersistOptions(userId);

    optionsByUser.set(userId, created);
    return created;
};
