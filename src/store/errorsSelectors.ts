import type { ErrorsStore } from './errorsStore';

export const selectDashboardNextPageError = (s: ErrorsStore) => s.errors.dashboard.nextPage;
export const selectGroupNextPageError = (s: ErrorsStore) => s.errors.group.nextPage;
export const selectActivityNextPageError = (s: ErrorsStore) => s.errors.activity.nextPage;
export const selectActivitySubeventsError = (s: ErrorsStore) =>
    s.errors.activity.subeventsData;
export const selectActivitySubeventsNextPageError = (s: ErrorsStore) =>
    s.errors.activity.subeventsNextPage;
