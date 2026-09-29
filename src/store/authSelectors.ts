import { AUTH_STATUS } from './authConstants';
import { AuthStore } from './authStore';

export const selectAuthStatus = (s: AuthStore) => s.status;

export const selectIsLoggedIn = (s: AuthStore) => s.status === AUTH_STATUS.AUTHENTICATED;

export const selectIsUnauthenticated = (s: AuthStore) => s.status === AUTH_STATUS.UNAUTHENTICATED;

export const selectIsAuthResolved = (s: AuthStore) => s.status !== AUTH_STATUS.UNKNOWN;

export const selectUnauthReason = (s: AuthStore) => s.unauthReason;

export const selectIsNewUser = (s: AuthStore) => s.isNewUser;
