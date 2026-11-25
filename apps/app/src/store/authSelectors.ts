import { AUTH_STATUS, UNAUTH_REASON } from './authConstants';
import type { AuthStore } from './authStore';

export const selectAuthStatus = (s: AuthStore) => s.status;

export const selectIsLoggedIn = (s: AuthStore) => s.status === AUTH_STATUS.AUTHENTICATED;

/**
 * AUTH-077 (#836): whether the UI may show the user's cached data (not whether it may fetch it):
 * signed in, or a session that expired or turned invalid. The expired page stays mounted, inert and
 * hidden under `AuthModal` (spec 04 §2.3) on the tab user's own client (`usePersistedUserId`), so
 * its data stays selected; requests still need a signed-in session. Signed out, missing, an error or
 * no reason: nothing is read.
 */
export const selectCanReadUserCache = (s: AuthStore) =>
    s.status === AUTH_STATUS.AUTHENTICATED ||
    (s.status === AUTH_STATUS.UNAUTHENTICATED &&
        (s.unauthReason === UNAUTH_REASON.EXPIRED || s.unauthReason === UNAUTH_REASON.INVALID));

export const selectIsUnauthenticated = (s: AuthStore) => s.status === AUTH_STATUS.UNAUTHENTICATED;

export const selectIsAuthResolved = (s: AuthStore) => s.status !== AUTH_STATUS.UNKNOWN;

export const selectUnauthReason = (s: AuthStore) => s.unauthReason;

export const selectIsNewUser = (s: AuthStore) => s.isNewUser;

export const selectSessionMode = (s: AuthStore) => s.sessionMode;
