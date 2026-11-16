import * as Sentry from '@sentry/react';
import { QueryClient } from '@tanstack/react-query';
import {
    persistQueryClientRestore,
    persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { get, set } from 'idb-keyval';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';

import { queryCacheKey } from './constants';
import { persistOptions, QUERY_CACHE_BUSTER, resetPersistFailureReport } from './queryPersister';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
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
