// Public entry of entities/dashboard: the balance totals and the activity feed queries.
export {
    dashboardActivityQueryOptions,
    dashboardBalancesQueryOptions,
    dashboardKeys,
    trimDashboardFeed,
    useDashboardActivityQuery,
    useDashboardBalancesQuery,
} from './api/queries';
export type { DashboardActivityPage, DashboardBalances } from './model/types';
