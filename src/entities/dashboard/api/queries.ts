// The dashboard (spec 03 §1.2, §6 row 2): the balance totals and the activity feed, 30 s fresh,
// persisted (the feed as its first page only, `trimmingPersister`). `dashboardKeys.all`
// invalidates both after a ledger or group change.
import {
    infiniteQueryOptions,
    queryOptions,
    useInfiniteQuery,
    useQuery,
} from '@tanstack/react-query';

import { fetchActivityPreviews } from 'api/activityApi';
import { api } from 'shared/api/client';

import { toDashboardBalances } from '../model/toDashboardBalances';
import type { DashboardActivityPage } from '../model/types';

const DASHBOARD_STALE_TIME = 30_000;
// The page size of the feed, as the server's `/dashboard` preview.
const ACTIVITY_PAGE_SIZE = 20;
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
const fetchActivityPage = (
    cursor: number | null,
    signal: AbortSignal,
): Promise<DashboardActivityPage> =>
    fetchActivityPreviews({ limit: ACTIVITY_PAGE_SIZE, cursor: cursor ?? undefined }, signal).then(
        ({ items, nextCursor }) => ({ items, nextCursor }),
    );

/** The feed, newest first: the first page without a cursor, then by `nextCursor` until null. */
export const dashboardActivityQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: dashboardKeys.activity(),
        staleTime: DASHBOARD_STALE_TIME,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchActivityPage(pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
    });

export const useDashboardBalancesQuery = () => useQuery(dashboardBalancesQueryOptions());

export const useDashboardActivityQuery = () => useInfiniteQuery(dashboardActivityQueryOptions());
