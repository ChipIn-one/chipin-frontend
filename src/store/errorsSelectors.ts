import type { ErrorsStore } from './errorsStore';

export const selectActivitySubeventsError = (s: ErrorsStore) => s.errors.activity.subeventsData;
export const selectActivitySubeventsNextPageError = (s: ErrorsStore) =>
    s.errors.activity.subeventsNextPage;
