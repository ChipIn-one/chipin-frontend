import type { LoadingStore } from './loadingStore';

export const selectAuthLoginLoading = (s: LoadingStore) => s.auth.login === 'loading';
export const selectAuthSignOutLoading = (s: LoadingStore) => s.auth.signOut === 'loading';
export const selectAuthLogoutOtherDevicesLoading = (s: LoadingStore) =>
    s.auth.logoutOtherDevices === 'loading';

export const selectActivitySubeventsLoading = (s: LoadingStore) =>
    s.activity.subeventsData === 'loading';
export const selectActivitySubeventsFetched = (s: LoadingStore) =>
    s.activity.subeventsData === 'fetched';
export const selectActivitySubeventsNextPageLoading = (s: LoadingStore) =>
    s.activity.subeventsNextPage === 'loading';

export const selectExpenseAdding = (s: LoadingStore) => s.expense.add === 'loading';
export const selectExpenseEditing = (s: LoadingStore) => s.expense.edit === 'loading';
export const selectExpenseUpdating = (s: LoadingStore) => s.expense.update === 'loading';
export const selectLedgerEntryRemoving = (s: LoadingStore) => s.ledger.remove === 'loading';
export const selectSettlementAdding = (s: LoadingStore) => s.settlement.add === 'loading';
