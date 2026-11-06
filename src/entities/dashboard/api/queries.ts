// The dashboard (spec 03 §1.2, §6 row 2): the balance totals and the activity feed, 30 s fresh,
// persisted (the feed as its first page only, `trimmingPersister`). `dashboardKeys.all`
// invalidates both after a ledger or group change. The feed key stays `['dashboard','activity']`
// until 03-12 moves it to `activity.self` (spec 03 §1.2, §6 row 2).
import { useEffect } from 'react';
import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';
import {
    infiniteQueryOptions,
    queryOptions,
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';

import { fetchActivityPreviews } from 'api/activityApi';
import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { api } from 'shared/api/client';
import { isNetworkUsable } from 'shared/offline/network';

import { toDashboardBalances } from '../model/toDashboardBalances';
import type { DashboardActivityPage } from '../model/types';

const DASHBOARD_STALE_TIME = 30_000;
// The first page has no cursor (a function: a typed constant would narrow to `null`).
const firstPageParam = (): number | null => null;

export const dashboardKeys = {
    all: ['dashboard'] as const,
    balances: () => [...dashboardKeys.all, 'balances'] as const,
    activity: () => [...dashboardKeys.all, 'activity'] as const,
};

export const dashboardBalancesQueryOptions = () =>
    queryOptions({
        queryKey: dashboardKeys.balances(),
        staleTime: DASHBOARD_STALE_TIME,
        queryFn: ({ signal }) =>
            api('get', '/dashboard/balances', { signal }).then(toDashboardBalances),
    });

// LEGACY until 03-12: the feed comes through the legacy `src/api` layer, see `DashboardActivityPage`.
// A change to the legacy `ActivityFeedItem` shape or its normalization requires bumping
// `QUERY_CACHE_EPOCH`: the feed is persisted and `MODEL_SHAPE_HASH` does not see that shape.
const fetchActivityPage = (
    cursor: number | null,
    signal: AbortSignal,
): Promise<DashboardActivityPage> =>
    fetchActivityPreviews({ limit: ACTIVITY_API_LIMIT, cursor: cursor ?? undefined }, signal).then(
        ({ items, nextCursor }) => ({ items, nextCursor }),
    );

type FeedData = InfiniteData<DashboardActivityPage, number | null>;
type FeedQuery = Query<
    DashboardActivityPage,
    Error,
    FeedData,
    ReturnType<typeof dashboardKeys.activity>
>;

const firstPageOnly = <P>(
    data: InfiniteData<DashboardActivityPage, P>,
): InfiniteData<DashboardActivityPage, P> => ({
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
});

// A refetch of an infinite query reloads every loaded page in turn. The feed is cut back to its
// first page before a refetch, so a refetch is one request, as the legacy store's reload was.
// The cut keeps the data's age and invalidation, so whether it refetches does not change. Offline
// nothing is cut: the loaded pages stay readable until the network is back.
const trimBeforeRefetch = (query: FeedQuery): boolean => {
    const { data, dataUpdatedAt, isInvalidated } = query.state;

    if (
        isNetworkUsable() &&
        data &&
        data.pages.length > 1 &&
        query.isStaleByTime(DASHBOARD_STALE_TIME)
    ) {
        // `manual`: a paused fetch keeps its status.
        query.setData(firstPageOnly(data), { updatedAt: dataUpdatedAt, manual: true });
        if (isInvalidated) {
            query.invalidate();
        }
    }
    return true;
};

/** The feed, newest first: the first page without a cursor, then by `nextCursor` until null. */
export const dashboardActivityQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: dashboardKeys.activity(),
        staleTime: DASHBOARD_STALE_TIME,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchActivityPage(pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
        // Pinned to TanStack Query 5.105: these callbacks run only in `onFocus`/`onOnline`, never
        // during render, so they may cut the cache (re-check on a TanStack upgrade).
        refetchOnWindowFocus: trimBeforeRefetch,
        refetchOnReconnect: trimBeforeRefetch,
    });

/**
 * Cuts the cached feed to its first page (keeping its age): call it before invalidating the
 * dashboard, so the refetch sends one feed request.
 */
export const trimDashboardFeed = (client: QueryClient): void => {
    const { queryKey } = dashboardActivityQueryOptions();
    const data = client.getQueryData(queryKey);

    if (data && data.pages.length > 1) {
        client.setQueryData(queryKey, firstPageOnly(data), {
            updatedAt: client.getQueryState(queryKey)?.dataUpdatedAt,
        });
    }
};

export const useDashboardBalancesQuery = () => useQuery(dashboardBalancesQueryOptions());

/**
 * The feed of the dashboard page. When the page unmounts, the feed is cut to its first page: the
 * stale refetch of the next mount (`refetchOnMount` runs during render, it cannot cut) is then one
 * request, not one per page loaded before.
 */
export const useDashboardActivityQuery = () => {
    const client = useQueryClient();

    useEffect(
        () => () => {
            trimDashboardFeed(client);
        },
        [client],
    );
    return useInfiniteQuery(dashboardActivityQueryOptions());
};
