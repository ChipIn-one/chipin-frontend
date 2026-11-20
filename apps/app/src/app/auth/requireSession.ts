import { redirect } from 'react-router-dom';

import { hasAuthSessionHint } from 'helpers/localStorage';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { isNetworkUsable } from 'shared/offline/network';
import { restoreReady } from 'shared/offline/restore';
import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';

import { authReady, readSession, type Session, UNKNOWN_OFFLINE } from './session';

/**
 * What a protected route shows for a session (spec 04 §2.3, the `requireSession` table; before
 * 04-2f an unauthenticated user sees what they saw before: `SIGNED_OUT` → the landing, `MISSING` →
 * `AuthModal`):
 * - `pass`: the page;
 * - `landing`: a redirect to the landing of the last account;
 * - `modal`: `AuthModal` alone;
 * - `modalOverPage`: `AuthModal` over the page, which stays mounted but hidden (an expired session).
 */
export type SessionAccess = 'pass' | 'landing' | 'modal' | 'modalOverPage';

export interface SessionEnvironment {
    /** The session hint of `helpers/localStorage`: the last session on this device was alive. */
    hasSessionHint: boolean;
    /** `isNetworkUsable()` (spec 03 §1.7), never `navigator.onLine`. */
    isNetworkUsable: boolean;
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
            return 'landing';
        case UNAUTH_REASON.EXPIRED:
        case UNAUTH_REASON.INVALID:
            return 'modalOverPage';
        case UNAUTH_REASON.ERROR:
        case UNAUTH_REASON.PERSISTENCE_ERROR:
            return offlineCache;
        default:
            // `MISSING` (never signed in on this device).
            return 'modal';
    }
};

/** The environment of `sessionAccess` now. */
export const readSessionEnvironment = (): SessionEnvironment => ({
    hasSessionHint: hasAuthSessionHint(),
    isNetworkUsable: isNetworkUsable(),
});

/**
 * The loader of `AuthLayout`: waits for the restored cache (`restoreReady`) and the session check
 * (`authReady`, at most 5 s), then redirects only an explicit sign-out to the landing. It decides by
 * the live session at that moment, not by what `authReady` saw, and never deletes user data. The
 * modal rows are rendered by `AuthLayout`, which also follows later session changes.
 */
export const requireSession = ({ request }: { request: Request }): Promise<Response | null> =>
    restoreReady
        .then(() => authReady(new URL(request.url).pathname))
        .then(() =>
            sessionAccess(readSession(), readSessionEnvironment()) === 'landing'
                ? redirect(getLastAccountLandingPath())
                : null,
        );
