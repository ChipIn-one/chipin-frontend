import { redirect } from 'react-router-dom';

import { hasAuthSessionHint } from 'helpers/localStorage';
import { loginPathFor } from 'helpers/url';
import { isNetworkUsable } from 'shared/offline/network';
import { restoreReady } from 'shared/offline/restore';
import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { authReady, readSession, type Session, UNKNOWN_OFFLINE } from './session';

/**
 * What a protected route shows for a session (spec 04 §2.3, the `requireSession` table):
 * - `pass`: the page;
 * - `login`: a redirect to `/login?returnTo=<the path>` (signed out earlier or in another tab, or
 *   never signed in, 04-2f);
 * - `leaving`: an explicit sign-out in this tab is leaving for the landing with a full navigation
 *   (`authStore.signOut`, spec 04 §2.3): the loader only, no redirect, no page;
 * - `modal`: `AuthModal` alone;
 * - `modalOverPage`: `AuthModal` over the page, which stays mounted but hidden (an expired session).
 */
export type SessionAccess = 'pass' | 'login' | 'leaving' | 'modal' | 'modalOverPage';

export interface SessionEnvironment {
    /** The session hint of `helpers/localStorage`: the last session on this device was alive. */
    hasSessionHint: boolean;
    /** `isNetworkUsable()` (spec 03 §1.7), never `navigator.onLine`. */
    isNetworkUsable: boolean;
    /** `authStore.isLeavingAfterSignOut`: this tab signed out and is leaving for the landing. */
    isLeavingAfterSignOut: boolean;
}

export const sessionAccess = (session: Session, env: SessionEnvironment): SessionAccess => {
    // D2: offline with a live session hint the cached data is shown, never a redirect.
    const offlineCache = env.hasSessionHint && !env.isNetworkUsable ? 'pass' : 'modal';

    if (session.status === AUTH_STATUS.AUTHENTICATED) {
        return 'pass';
    }
    if (session.status === UNKNOWN_OFFLINE) {
        return offlineCache;
    }
    switch (session.reason) {
        case UNAUTH_REASON.SIGNED_OUT:
            return env.isLeavingAfterSignOut ? 'leaving' : 'login';
        case UNAUTH_REASON.MISSING:
            return 'login';
        case UNAUTH_REASON.EXPIRED:
        case UNAUTH_REASON.INVALID:
            return 'modalOverPage';
        case UNAUTH_REASON.ERROR:
        case UNAUTH_REASON.PERSISTENCE_ERROR:
            return offlineCache;
        default:
            // No reason recorded: the sign-in modal, as before.
            return 'modal';
    }
};

/** The environment of `sessionAccess` now. */
export const readSessionEnvironment = (): SessionEnvironment => ({
    hasSessionHint: hasAuthSessionHint(),
    isNetworkUsable: isNetworkUsable(),
    isLeavingAfterSignOut: useAuthStore.getState().isLeavingAfterSignOut,
});

/**
 * The loader of `AuthLayout`: waits for the restored cache (`restoreReady`) and the session check
 * (`authReady`, at most 5 s), then redirects a signed-out or never-signed-in user to
 * `/login?returnTo=<pathname + search>`. It decides by the live session at that moment, not by what
 * `authReady` saw, and never deletes user data. The modal rows are rendered by `AuthLayout`, which
 * also follows later session changes.
 */
export const requireSession = ({ request }: { request: Request }): Promise<Response | null> => {
    const url = new URL(request.url);

    return restoreReady
        .then(() => authReady(url.pathname))
        .then(() =>
            sessionAccess(readSession(), readSessionEnvironment()) === 'login'
                ? redirect(loginPathFor(url.pathname + url.search))
                : null,
        );
};
