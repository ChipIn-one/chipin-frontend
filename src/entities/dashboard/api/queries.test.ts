import {
    dehydrate,
    focusManager,
    InfiniteQueryObserver,
    onlineManager,
    QueryClient,
} from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { ActivityFeedItem } from 'api/chipin.types';
import { currencyCode, fromUnits } from 'shared/money';
import { dehydrateOptions, trimInfinitePages } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import {
    dashboardActivityQueryOptions,
    dashboardBalancesQueryOptions,
    dashboardKeys,
} from './queries';

const server = setupMswServer();

const preview = (id: string) =>
    ({ parent: { id }, lastEvent: { id } }) as unknown as ActivityFeedItem;

test("dashboard keys share the 'dashboard' root and stay fresh for 30 s", () => {
    expect(dashboardKeys.all).toEqual(['dashboard']);
    expect(dashboardKeys.balances()).toEqual(['dashboard', 'balances']);
    expect(dashboardKeys.activity()).toEqual(['dashboard', 'activity']);
    expect(dashboardBalancesQueryOptions().staleTime).toBe(30_000);
    expect(dashboardActivityQueryOptions().staleTime).toBe(30_000);
});

test('loads the balance totals through the lossless transport as Money', async () => {
    server.use(
        http.get(
            '*/dashboard/balances',
            () =>
                new HttpResponse(
                    '{"balances":{"USD":{"currency":"USD","netBalance":365963032346.3555}}}',
                    { headers: { 'Content-Type': 'application/json' } },
                ),
        ),
    );

    await expect(new QueryClient().fetchQuery(dashboardBalancesQueryOptions())).resolves.toEqual([
        fromUnits(3_659_630_323_463_555n, currencyCode('USD')),
    ]);
});

test('pages the feed by cursor and persists only its first page', async () => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activity-previews', ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            cursors.push(cursor);
            expect(url.searchParams.get('limit')).toBe('20');
            return HttpResponse.json(
                cursor === null
                    ? { items: [preview('a')], nextCursor: 40 }
                    : { items: [preview('b')], nextCursor: null },
            );
        }),
    );
    const client = new QueryClient();

    const observer = new InfiniteQueryObserver(client, dashboardActivityQueryOptions());

    await observer.refetch();
    await observer.fetchNextPage();

    const data = client.getQueryData(dashboardActivityQueryOptions().queryKey);

    expect(cursors).toEqual([null, '40']);
    expect(data?.pages.map(page => page.nextCursor)).toEqual([40, null]);
    const persisted = trimInfinitePages({
        timestamp: 0,
        buster: '',
        clientState: dehydrate(client, dehydrateOptions),
    });

    expect(persisted.clientState.queries[0]?.state.data).toEqual({
        pages: [{ items: [preview('a')], nextCursor: 40 }],
        pageParams: [null],
    });
});

test('a focus refetch of a stale feed reloads only its first page', async () => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activity-previews', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'));
            return HttpResponse.json({ items: [preview('new')], nextCursor: 40 });
        }),
    );
    const client = new QueryClient();
    const options = dashboardActivityQueryOptions();

    client.setQueryData(
        options.queryKey,
        {
            pages: [
                { items: [preview('a')], nextCursor: 40 },
                { items: [preview('b')], nextCursor: 30 },
                { items: [preview('c')], nextCursor: null },
            ],
            pageParams: [null, 40, 30],
        },
        // Older than the 30 s staleTime.
        { updatedAt: Date.now() - 60_000 },
    );
    const observer = new InfiniteQueryObserver(client, { ...options, refetchOnMount: false });
    const unsubscribe = observer.subscribe(() => undefined);

    // Focus events reach the cache of a mounted client only.
    client.mount();

    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);

        await vi.waitFor(() => {
            expect(client.getQueryState(options.queryKey)?.fetchStatus).toBe('idle');
            expect(cursors).toEqual([null]);
        });
        expect(client.getQueryData(options.queryKey)?.pages).toEqual([
            { items: [preview('new')], nextCursor: 40 },
        ]);
    } finally {
        unsubscribe();
        client.unmount();
        focusManager.setFocused(undefined);
    }
});

test('a focus while the feed is fresh keeps every loaded page', () => {
    const client = new QueryClient();
    const options = dashboardActivityQueryOptions();
    const data = {
        pages: [
            { items: [preview('a')], nextCursor: 40 },
            { items: [preview('b')], nextCursor: null },
        ],
        pageParams: [null, 40],
    };

    client.setQueryData(options.queryKey, data);
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    client.mount();

    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);

        expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(2);
    } finally {
        unsubscribe();
        client.unmount();
        focusManager.setFocused(undefined);
    }
});

test('offline, a focus keeps every loaded page of a stale feed', async () => {
    server.use(http.get('*/users/self/activity-previews', () => HttpResponse.error()));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = dashboardActivityQueryOptions();

    client.setQueryData(
        options.queryKey,
        {
            pages: [
                { items: [preview('a')], nextCursor: 40 },
                { items: [preview('b')], nextCursor: null },
            ],
            pageParams: [null, 40],
        },
        { updatedAt: Date.now() - 60_000 },
    );
    const observer = new InfiniteQueryObserver(client, { ...options, refetchOnMount: false });
    const unsubscribe = observer.subscribe(() => undefined);

    client.mount();
    onlineManager.setOnline(false);
    try {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        // The client handles focus after resuming paused mutations (a microtask later).
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(2);
    } finally {
        unsubscribe();
        client.unmount();
        onlineManager.setOnline(true);
        focusManager.setFocused(undefined);
    }
});
