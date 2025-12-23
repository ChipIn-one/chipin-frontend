import { AuthStore } from './authStore';

export const selectAuthStatus = (s: AuthStore) => s.status;

export const selectIsLoggedIn = (s: AuthStore) => s.status === 'authenticated';

export const selectIsUnauthenticated = (s: AuthStore) => s.status === 'unauthenticated';

export const selectIsAuthResolved = (s: AuthStore) => s.status !== 'unknown';

export const selectUnauthReason = (s: AuthStore) => s.unauthReason;
