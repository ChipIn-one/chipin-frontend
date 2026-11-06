import { InfiniteQueryObserver } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import type { DashboardActivityPage } from 'entities/dashboard';
import { dashboardActivityQueryOptions, dashboardKeys } from 'entities/dashboard';
import { clearLocalUserIdentity } from 'helpers/localStorage';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { invalidateDashboard } from './dashboardQueryBridge';

const server = setupMswServer();

let cache: UserDashboardCache | undefined;

afterEach(() => {
    cache?.dispose();
    cache = undefined;
});

test("marks the signed-in user's dashboard queries stale", async () => {
    cache = mountUserDashboardCache();

    await invalidateDashboard();

    expect(cache.isDashboardInvalidated()).toBe(true);
});

test('without a signed-in user or a mounted client it does nothing and resolves', async () => {
    clearLocalUserIdentity();

    await expect(invalidateDashboard()).resolves.toBeUndefined();
});

const page = (nextCursor: number | null): DashboardActivityPage => ({ items: [], nextCursor });

test('an invalidation refetches a feed of three loaded pages with one request', async () => {
    cache = mountUserDashboardCache();
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activity-previews', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'));
            return HttpResponse.json(page(40));
        }),
        http.get('*/dashboard/balances', () => HttpResponse.json({ balances: {} })),
    );
    cache.client.setQueryData(dashboardActivityQueryOptions().queryKey, {
        pages: [page(40), page(30), page(20)],
        pageParams: [null, 40, 30],
    });
    // The dashboard page is open: the feed query is active and refetches on invalidation.
    const observer = new InfiniteQueryObserver(cache.client, dashboardActivityQueryOptions());
    const unsubscribe = observer.subscribe(() => undefined);

    try {
        await invalidateDashboard();

        expect(cursors).toEqual([null]);
        expect(cache.client.getQueryData(dashboardKeys.activity())).toEqual({
            pages: [page(40)],
            pageParams: [null],
        });
    } finally {
        unsubscribe();
    }
});
