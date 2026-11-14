// The dashboard (spec 03 §1.2, §6 row 2): the balance totals, 30 s fresh, persisted.
// `dashboardKeys.all` invalidates them after a ledger or group change. The dashboard's activity
// feed is the user's own previews in `entities/activity` (`activity.self`, since 03-12).
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from 'shared/api/client';

import { toDashboardBalances } from '../model/toDashboardBalances';

const DASHBOARD_STALE_TIME = 30_000;

export const dashboardKeys = {
    all: ['dashboard'] as const,
    balances: () => [...dashboardKeys.all, 'balances'] as const,
};

export const dashboardBalancesQueryOptions = () =>
    queryOptions({
        queryKey: dashboardKeys.balances(),
        staleTime: DASHBOARD_STALE_TIME,
        queryFn: ({ signal }) =>
            api('get', '/dashboard/balances', { signal }).then(toDashboardBalances),
    });

export const useDashboardBalancesQuery = () => useQuery(dashboardBalancesQueryOptions());
