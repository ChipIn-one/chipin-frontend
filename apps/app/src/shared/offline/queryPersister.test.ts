import * as Sentry from '@sentry/react';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import {
    persistQueryClientRestore,
    persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { get, set } from 'idb-keyval';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from 'shared/lib/apiError';
import { currencyCode, fromUnits } from 'shared/money';

import { queryCacheKey } from './constants';
import { persistOptions, QUERY_CACHE_BUSTER, resetPersistFailureReport } from './queryPersister';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
// The keys a test marks as having an unsent outbox operation.
const pendingOpKeys = vi.hoisted(() => new Set<string>());

vi.mock('./pendingOps', () => ({
    isEntryWithPendingOp: (queryKey: readonly unknown[]) =>
        pendingOpKeys.has(JSON.stringify(queryKey)),
}));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, set: vi.fn(actual.set) };
});

// Test keys (the entity key factories do not exist yet).
const DASHBOARD_KEY = ['dashboard'];
const GROUPS_KEY = ['groups', 'list'];
const ACTIVITY_KEY = ['activity', 'self', {}];
const STATS_KEY = ['stats'];

const newClient = (): QueryClient => new QueryClient();

// Every test uses its own user: the persister is memoized per user and throttled (1 s).
let userSeq = 0;
const nextUser = (): string => `user-${++userSeq}`;

const save = (userId: string, client: QueryClient): Promise<void> => {
    const options = persistOptions(userId);

    return persistQueryClientSave({
        queryClient: client,
        persister: options.persister,
        buster: options.buster,
        dehydrateOptions: options.dehydrateOptions,
    });
};

const restore = (userId: string, client: QueryClient): Promise<void> => {
    const options = persistOptions(userId);

    return persistQueryClientRestore({
        queryClient: client,
        persister: options.persister,
        maxAge: options.maxAge,
        buster: options.buster,
    });
};

beforeEach(() => {
    pendingOpKeys.clear();
    vi.mocked(Sentry.captureMessage).mockClear();
    // Once per session: every test starts as a new session, independent of the order.
    resetPersistFailureReport();
});

describe('query cache persister', () => {
    test('Money { minor: 9999999999999999999n } survives persist → restore (C1-05)', async () => {
        const userId = nextUser();
        const source = newClient();
        const balance = fromUnits(9999999999999999999n, currencyCode('USD'));
        source.setQueryData(DASHBOARD_KEY, { balance });

        await save(userId, source);
        const target = newClient();
        await restore(userId, target);

        const restored = target.getQueryData<{ balance: { minor: unknown } }>(DASHBOARD_KEY);
        expect(typeof restored?.balance.minor).toBe('bigint');
        expect(restored?.balance.minor).toBe(9999999999999999999n);
    });

    test("X's cache is not visible to Y", async () => {
        const userX = nextUser();
        const userY = nextUser();
        const source = newClient();
        source.setQueryData(GROUPS_KEY, ['x-group']);

        await save(userX, source);
        const target = newClient();
        await restore(userY, target);

        expect(target.getQueryData(GROUPS_KEY)).toBeUndefined();
        expect(await get(queryCacheKey(userX))).toEqual(expect.any(String));
    });

    test('a buster mismatch drops the stored cache', async () => {
        const userId = nextUser();
        await set(
            queryCacheKey(userId),
            JSON.stringify({
                timestamp: Date.now(),
                buster: '0:stale',
                clientState: { queries: [], mutations: [] },
            }),
        );

        await restore(userId, newClient());

        expect(QUERY_CACHE_BUSTER).not.toBe('0:stale');
        expect(await get(queryCacheKey(userId))).toBeUndefined();
    });

    test('an entry older than maxAge restores nothing', async () => {
        const userId = nextUser();
        const source = newClient();
        source.setQueryData(DASHBOARD_KEY, { ok: true });
        await save(userId, source);
        const stored = await get<string>(queryCacheKey(userId));
        const old = JSON.parse(stored ?? '{}') as { timestamp: number };
        await set(
            queryCacheKey(userId),
            JSON.stringify({ ...old, timestamp: Date.now() - persistOptions(userId).maxAge - 1 }),
        );

        const target = newClient();
        await restore(userId, target);

        expect(target.getQueryData(DASHBOARD_KEY)).toBeUndefined();
    });

    test('an infinite query is persisted with its first page only', async () => {
        const userId = nextUser();
        const source = newClient();
        source.setQueryData(ACTIVITY_KEY, {
            pages: [[1], [2], [3]],
            pageParams: [0, 1, 2],
        });

        await save(userId, source);
        const target = newClient();
        await restore(userId, target);

        expect(target.getQueryData(ACTIVITY_KEY)).toEqual({
            pages: [[1]],
            pageParams: [0],
        });
    });

    test('meta.persist=false, unsuccessful queries and mutations are not persisted', async () => {
        const userId = nextUser();
        const source = newClient();
        source.setQueryData(DASHBOARD_KEY, { ok: true });
        await source.prefetchQuery({
            queryKey: STATS_KEY,
            queryFn: () => ({ users: 1 }),
            meta: { persist: false },
        });
        await source.prefetchQuery({
            queryKey: GROUPS_KEY,
            queryFn: () => Promise.reject(new Error('boom')),
            retry: false,
        });
        void source
            .getMutationCache()
            .build(source, { mutationFn: () => Promise.resolve() })
            .execute(undefined);

        await save(userId, source);
        const stored = await get<string>(queryCacheKey(userId));
        const parsed = JSON.parse(stored ?? '{}') as {
            clientState: { queries: { queryKey: unknown }[]; mutations: unknown[] };
        };

        expect(parsed.clientState.queries.map(query => query.queryKey)).toEqual([DASHBOARD_KEY]);
        expect(parsed.clientState.mutations).toEqual([]);
    });

    test('a setItem error reaches Sentry offline.persist_failed once per session', async () => {
        vi.mocked(set).mockRejectedValue(new DOMException('quota', 'QuotaExceededError'));
        const first = nextUser();
        const second = nextUser();
        const source = newClient();
        source.setQueryData(DASHBOARD_KEY, { ok: true });

        await save(first, source);
        await save(second, source);

        expect(Sentry.captureMessage).toHaveBeenCalledOnce();
        expect(Sentry.captureMessage).toHaveBeenCalledWith('offline.persist_failed', {
            level: 'warning',
            tags: { 'offline.error': 'QuotaExceededError' },
        });
        vi.mocked(set).mockReset();
    });
});

interface StoredQuery {
    queryKey: unknown;
    state: Record<string, unknown>;
}

const storedQueries = async (userId: string): Promise<StoredQuery[]> => {
    const stored = await get<string>(queryCacheKey(userId));
    const parsed = JSON.parse(stored ?? '{}') as { clientState: { queries: StoredQuery[] } };

    return parsed.clientState.queries;
};

const rejectWith = (error: Error) => () => Promise.reject(error);

/** A query that had data and whose refetch then failed with `error`: `status: 'error'` with data. */
const failRefetch = async (client: QueryClient, queryKey: string[], error: Error) => {
    client.setQueryData(queryKey, { ok: true }, { updatedAt: 1000 });
    await client
        .fetchQuery({ queryKey, queryFn: rejectWith(error), retry: false })
        .catch(() => undefined);
};

const networkError = () => new Error('Network Error');
const apiError = (status: number, code?: string) =>
    new ApiError({ status, payload: code === undefined ? undefined : { code }, cause: null });

describe('a query kept with data after a failed fetch', () => {
    test('NET-001: an infinite feed whose next page failed is persisted as its last success, first page only', async () => {
        const userId = nextUser();
        const source = newClient();
        let failNext = false;
        const options = {
            queryKey: ACTIVITY_KEY,
            queryFn: ({ pageParam }: { pageParam: number }) =>
                failNext ? Promise.reject(networkError()) : Promise.resolve([pageParam]),
            initialPageParam: 0,
            getNextPageParam: (_last: number[], pages: number[][]) => pages.length,
            retry: false,
        };
        const observer = new InfiniteQueryObserver(source, options);
        const unsubscribe = observer.subscribe(() => undefined);

        try {
            await observer.refetch();
            await observer.fetchNextPage();
            await observer.fetchNextPage();
            failNext = true;
            await observer.fetchNextPage();
        } finally {
            unsubscribe();
        }
        const before = source.getQueryState(ACTIVITY_KEY);
        expect(before?.status).toBe('error');
        expect(before?.fetchMeta).not.toBeNull();

        await save(userId, source);
        const [stored] = await storedQueries(userId);

        expect(stored?.state).toMatchObject({
            status: 'success',
            error: null,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            dataUpdatedAt: before?.dataUpdatedAt,
            data: { pages: [[0]], pageParams: [0] },
        });

        const target = newClient();
        await restore(userId, target);

        expect(target.getQueryState(ACTIVITY_KEY)).toMatchObject({
            status: 'success',
            error: null,
            dataUpdatedAt: before?.dataUpdatedAt,
        });
        expect(target.getQueryData(ACTIVITY_KEY)).toEqual({ pages: [[0]], pageParams: [0] });
    });

    test('NET-001: a refetch that failed on the network or with a 5xx persists the data as success, keeping its age and invalidation', async () => {
        const userId = nextUser();
        const source = newClient();
        await failRefetch(source, DASHBOARD_KEY, networkError());
        await failRefetch(source, GROUPS_KEY, apiError(503));

        await save(userId, source);
        const target = newClient();
        await restore(userId, target);

        // A failed fetch marks the entry invalidated: restored, it still refetches when shown.
        expect(target.getQueryState(DASHBOARD_KEY)).toMatchObject({
            status: 'success',
            data: { ok: true },
            dataUpdatedAt: 1000,
            isInvalidated: true,
        });
        expect(target.getQueryState(GROUPS_KEY)).toMatchObject({
            status: 'success',
            data: { ok: true },
            dataUpdatedAt: 1000,
            isInvalidated: true,
        });
    });

    test('NET-001: a refetch that failed with a transient 4xx (429, 409 SYSTEM.CONFLICT, 408) persists the data as success', async () => {
        const userId = nextUser();
        const source = newClient();
        const failures: [string[], ApiError][] = [
            [['groups', 'detail', 'g-429'], apiError(429)],
            [['groups', 'detail', 'g-409'], apiError(409, 'SYSTEM.CONFLICT')],
            [['groups', 'detail', 'g-408'], apiError(408)],
        ];
        for (const [queryKey, error] of failures) {
            await failRefetch(source, queryKey, error);
        }

        await save(userId, source);
        const target = newClient();
        await restore(userId, target);

        for (const [queryKey] of failures) {
            expect(target.getQueryState(queryKey)).toMatchObject({
                status: 'success',
                data: { ok: true },
                dataUpdatedAt: 1000,
            });
        }
    });

    test('NET-001: an error without data, a 401/403/404/410 ApiError, meta.persist=false and a pending op are not persisted', async () => {
        const userId = nextUser();
        const source = newClient();
        const pendingKey = ['ledger', 'entry', 'entry-1'];
        await source.prefetchQuery({
            queryKey: STATS_KEY,
            queryFn: () => Promise.reject(networkError()),
            retry: false,
        });
        await failRefetch(source, ['groups', 'detail', 'g-404'], apiError(404));
        await failRefetch(source, ['groups', 'detail', 'g-403'], apiError(403));
        await failRefetch(source, ['groups', 'detail', 'g-401'], apiError(401));
        await failRefetch(source, ['groups', 'detail', 'g-410'], apiError(410));
        source.setQueryData(DASHBOARD_KEY, { ok: true });
        await source
            .fetchQuery({
                queryKey: DASHBOARD_KEY,
                queryFn: () => Promise.reject(networkError()),
                retry: false,
                meta: { persist: false },
            })
            .catch(() => undefined);
        await failRefetch(source, pendingKey, networkError());
        pendingOpKeys.add(JSON.stringify(pendingKey));

        await save(userId, source);

        expect(await storedQueries(userId)).toEqual([]);
    });
});

describe('no error object reaches IndexedDB', () => {
    const TOKEN = 'secret-access-token';
    // An Axios network error serializes its request config, the `Authorization` header included.
    const axiosNetworkError = () =>
        Object.assign(new Error('Network Error'), {
            code: 'ERR_NETWORK',
            config: { headers: { Authorization: `Bearer ${TOKEN}` } },
        });

    test('NET-001: a success whose failed attempt waits to retry is stored without its fetchFailureReason or the request headers', async () => {
        const userId = nextUser();
        const source = newClient();
        const failures = [
            { queryKey: DASHBOARD_KEY, error: axiosNetworkError() },
            {
                queryKey: GROUPS_KEY,
                error: new ApiError({
                    status: 503,
                    payload: undefined,
                    cause: axiosNetworkError(),
                }),
            },
        ];
        const fetches = failures.map(({ queryKey, error }) => {
            source.setQueryData(queryKey, { ok: true }, { updatedAt: 1000 });
            return source
                .fetchQuery({ queryKey, queryFn: rejectWith(error), retry: 1, retryDelay: 60_000 })
                .catch(() => undefined);
        });

        try {
            await vi.waitFor(() => {
                for (const { queryKey } of failures) {
                    expect(source.getQueryState(queryKey)).toMatchObject({
                        status: 'success',
                        fetchFailureCount: 1,
                    });
                }
            });
            expect(source.getQueryState(DASHBOARD_KEY)?.fetchFailureReason).toBe(
                failures[0]?.error,
            );

            await save(userId, source);
        } finally {
            await source.cancelQueries();
            await Promise.all(fetches);
        }
        const stored = (await get<string>(queryCacheKey(userId))) ?? '';

        expect(stored).not.toContain('Authorization');
        expect(stored).not.toContain(TOKEN);
        const queries = await storedQueries(userId);
        expect(queries).toHaveLength(2);
        for (const query of queries) {
            expect(query.state).toMatchObject({
                status: 'success',
                data: { ok: true },
                error: null,
                fetchFailureCount: 0,
                fetchFailureReason: null,
                fetchMeta: null,
            });
        }
    });
});
