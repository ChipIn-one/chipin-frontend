import type { LoadingStore } from './loadingStore';

export const selectAuthLoginLoading = (s: LoadingStore) => s.auth.login === 'loading';
export const selectAuthSignOutLoading = (s: LoadingStore) => s.auth.signOut === 'loading';
export const selectAuthLogoutOtherDevicesLoading = (s: LoadingStore) =>
    s.auth.logoutOtherDevices === 'loading';
