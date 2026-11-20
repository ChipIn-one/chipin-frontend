import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { markAuthSessionSignedOut, subscribeToRemoteAuthLogout } from 'helpers/authSession';
import { getLocalUser, getTabUserId, hasAuthSessionHint } from 'helpers/localStorage';
import { isNetworkError } from 'shared/api/client';
import { AUTH_STATUS, SESSION_MODE, UNAUTH_REASON } from 'store/authConstants';
import { selectAuthStatus, selectSessionMode } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { loadGroupsListForSession } from 'store/groupsList';
import { loadKnownUsersForSession, loadSelfUserForSession } from 'store/sessionUser';
import { useUiPrefsStore } from 'store/ui-prefs';

import { useTabUserId } from './useTabUserId';

interface SessionStart {
    since: number;
    hadCachedUser: boolean;
    switchedUser: boolean;
}

// `since`: when this session start began (before its refresh); `hadCachedUser`: a cached user
// existed then. `switchedUser`: the refresh found another user (§1.5, the refresh listener
// dropped the cached one), so that user's default app mode applies as for a fresh sign-in.
const loadSessionData = ({ since, hadCachedUser, switchedUser }: SessionStart): Promise<void> =>
    Promise.all([
        loadGroupsListForSession(since),
        loadSelfUserForSession(since).then(user => {
            if (user && (switchedUser || !hadCachedUser)) {
                useUiPrefsStore.getState().setDefaultAppMode(user.settings.soloModeByDefault);
            }
        }),
        loadKnownUsersForSession(since),
    ]).then(() => undefined);

// The attempt in flight (spec 04 §2.3: the route loader and this hook both start the check, it runs
// once). Any change of the auth store ends the dedupe: a later start may then try again, as the
// effect did on its dependency changes before.
let attemptInFlight: symbol | null = null;
useAuthStore.subscribe(() => {
    attemptInFlight = null;
});

/**
 * One attempt of the initial session check (cold start), outside React: the guard loader of
 * `app/auth/session.ts` starts it before any component mounts, `useCheckSignIn` starts it again on a
 * connectivity change. Does nothing once the session is resolved, on the OAuth callback (the
 * callback page signs in itself), or while an attempt started since the last auth change runs.
 * Offline or backend down the check waits for connectivity instead of signing out.
 */
const startSessionCheck = (pathname: string): void => {
    if (
        pathname === ROUTES.OAUTH_CALLBACK ||
        useAuthStore.getState().status !== AUTH_STATUS.UNKNOWN ||
        attemptInFlight !== null
    ) {
        return;
    }
    const { setUnauthenticated, setOfflineCachedSession, setAuthenticated, refreshAuthTokens } =
        useAuthStore.getState();

    if (!hasAuthSessionHint()) {
        setUnauthenticated(UNAUTH_REASON.MISSING);
        return;
    }

    const mode = useConnectivityStore.getState().mode;
    const hasCachedUserId = getTabUserId() !== undefined;

    if (mode !== 'online') {
        // Offline cold start (spec 03 §1.6): a refresh cannot reach the server, so a cached user
        // with a session hint goes straight to the cache. Backend down keeps waiting.
        if (mode === 'offline' && hasCachedUserId) {
            setOfflineCachedSession();
        }
        return;
    }

    const attempt = Symbol('session-check');
    attemptInFlight = attempt;
    const since = Date.now();
    const hadCachedUser = getLocalUser() !== null;
    const cachedIdBefore = getTabUserId();
    refreshAuthTokens()
        .then(() => {
            setAuthenticated();
            return loadSessionData({
                since,
                hadCachedUser,
                switchedUser: cachedIdBefore !== undefined && getTabUserId() !== cachedIdBefore,
            });
        })
        .catch((error: unknown) => {
            if (useAuthStore.getState().status !== AUTH_STATUS.UNKNOWN) {
                return;
            }
            // A network error during the refresh, classified offline before this `catch` runs:
            // the same offline cold start. Backend down keeps waiting; a one-off request error
            // is an `error`. The hint is read again, the refresh may have ended the session.
            if (
                isNetworkError(error) &&
                useConnectivityStore.getState().mode === 'offline' &&
                hasCachedUserId &&
                hasAuthSessionHint()
            ) {
                setOfflineCachedSession();
                return;
            }
            if (useConnectivityStore.getState().mode !== 'online') {
                return;
            }

            setUnauthenticated(UNAUTH_REASON.ERROR);
        })
        .finally(() => {
            if (attemptInFlight === attempt) {
                attemptInFlight = null;
            }
        });
};

/**
 * The reactive parts of the session check: the remote logout of another tab, a retry of the initial
 * check when connectivity returns, and the reconnect of an offline-cached session.
 */
export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const sessionMode = useAuthStore(selectSessionMode);
    // Offline or backend down: the session check waits for connectivity instead of signing out.
    const isDisconnected = useConnectivityStore(state => state.mode !== 'online');
    const isOffline = useConnectivityStore(state => state.mode === 'offline');
    const hasCachedUserId = useTabUserId() !== undefined;
    const refreshAuthTokens = useAuthStore(s => s.refreshAuthTokens);

    useEffect(() => {
        return subscribeToRemoteAuthLogout(() => {
            const current = useAuthStore.getState();
            if (
                current.status === AUTH_STATUS.UNAUTHENTICATED &&
                current.unauthReason === UNAUTH_REASON.SIGNED_OUT
            ) {
                return;
            }

            markAuthSessionSignedOut();
            current.setUnauthenticated(UNAUTH_REASON.SIGNED_OUT);
        });
    }, []);

    // The initial check, started again whenever its inputs change while the session is unknown.
    useEffect(() => {
        startSessionCheck(location.pathname);
    }, [hasCachedUserId, isDisconnected, isOffline, location.pathname, refreshAuthTokens, status]);

    // Reconnect of an offline-cached session: a 401 refresh expires the session (inside
    // `refreshAuthTokens`), a success makes it `online` and loads the data the cold start skipped.
    // A connectivity flap during the refresh must not start a second one (and load twice).
    const isReconnecting = useRef(false);
    useEffect(() => {
        if (
            status !== AUTH_STATUS.AUTHENTICATED ||
            sessionMode !== SESSION_MODE.OFFLINE_CACHED ||
            isDisconnected ||
            isReconnecting.current
        ) {
            return;
        }

        isReconnecting.current = true;
        const since = Date.now();
        const cachedIdBefore = getTabUserId();
        refreshAuthTokens()
            .then(() =>
                loadSessionData({
                    since,
                    hadCachedUser: true,
                    switchedUser: getTabUserId() !== cachedIdBefore,
                }),
            )
            .catch(() => {
                // A 401 has already expired the session; a network error keeps the cached
                // session, and the next reconnect (a connectivity change) tries again.
            })
            .finally(() => {
                isReconnecting.current = false;
            });
    }, [isDisconnected, refreshAuthTokens, sessionMode, status]);
};

export { startSessionCheck };
