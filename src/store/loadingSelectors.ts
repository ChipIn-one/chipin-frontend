import { LoadingStore } from './loadingStore';

export const selectDashboardLoading = (s: LoadingStore) => s.dashboard.data === 'loading';
export const selectDashboardFetched = (s: LoadingStore) => s.dashboard.data === 'fetched';

export const selectGroupDataLoading = (s: LoadingStore) => s.group.data === 'loading';
export const selectGroupDataFetched = (s: LoadingStore) => s.group.data === 'fetched';

export const selectGroupAdding = (s: LoadingStore) => s.group.add === 'loading';
export const selectGroupUpdating = (s: LoadingStore) => s.group.update === 'loading';
export const selectGroupRemoving = (s: LoadingStore) => s.group.remove === 'loading';
export const selectGroupJoining = (s: LoadingStore) => s.group.join === 'loading';
