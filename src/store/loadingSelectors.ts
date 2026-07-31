import { LoadingStore } from './loadingStore';

export const selectAuthLoginLoading = (s: LoadingStore) => s.auth.login === 'loading';
export const selectAuthSignOutLoading = (s: LoadingStore) => s.auth.signOut === 'loading';
export const selectAuthLogoutOtherDevicesLoading = (s: LoadingStore) =>
    s.auth.logoutOtherDevices === 'loading';

export const selectDashboardLoading = (s: LoadingStore) => s.dashboard.data === 'loading';
export const selectDashboardFetched = (s: LoadingStore) => s.dashboard.data === 'fetched';

export const selectActivityLoading = (s: LoadingStore) => s.activity.data === 'loading';
export const selectActivityFetched = (s: LoadingStore) => s.activity.data === 'fetched';
export const selectActivityNextPageLoading = (s: LoadingStore) => s.activity.nextPage === 'loading';
export const selectActivitySelectedEventLoading = (s: LoadingStore) =>
    s.activity.selectedEvent === 'loading';
export const selectActivitySelectedEventFetched = (s: LoadingStore) =>
    s.activity.selectedEvent === 'fetched';
export const selectActivitySubeventsLoading = (s: LoadingStore) =>
    s.activity.subeventsData === 'loading';
export const selectActivitySubeventsFetched = (s: LoadingStore) =>
    s.activity.subeventsData === 'fetched';
export const selectActivitySubeventsNextPageLoading = (s: LoadingStore) =>
    s.activity.subeventsNextPage === 'loading';

export const selectGroupDataLoading = (s: LoadingStore) => s.group.data === 'loading';
export const selectGroupDataFetched = (s: LoadingStore) => s.group.data === 'fetched';
export const selectGroupListLoading = (s: LoadingStore) => s.group.list === 'loading';
export const selectGroupListFetched = (s: LoadingStore) => s.group.list === 'fetched';

export const selectGroupAdding = (s: LoadingStore) => s.group.add === 'loading';
export const selectGroupUpdating = (s: LoadingStore) => s.group.update === 'loading';
export const selectGroupRemoving = (s: LoadingStore) => s.group.remove === 'loading';
export const selectGroupJoining = (s: LoadingStore) => s.group.join === 'loading';
export const selectGroupLeaving = (s: LoadingStore) => s.group.leave === 'loading';
export const selectGroupKicking = (s: LoadingStore) => s.group.kick === 'loading';

export const selectUserSelfLoading = (s: LoadingStore) => s.users.self === 'loading';
export const selectUserSelfFetched = (s: LoadingStore) => s.users.self === 'fetched';
export const selectFriendRemoving = (s: LoadingStore) => s.users.removeFriend === 'loading';
export const selectUserAvatarUploading = (s: LoadingStore) => s.users.avatar === 'loading';

export const selectExpenseAdding = (s: LoadingStore) => s.expense.add === 'loading';
export const selectLedgerEntryRemoving = (s: LoadingStore) => s.ledger.remove === 'loading';
export const selectSettlementAdding = (s: LoadingStore) => s.settlement.add === 'loading';
