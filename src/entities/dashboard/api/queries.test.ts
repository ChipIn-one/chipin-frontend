import { dehydrate, InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

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
