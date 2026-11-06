import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { markAuthSessionSignedOut, subscribeToRemoteAuthLogout } from 'helpers/authSession';
import { hasAuthSessionHint } from 'helpers/localStorage';
import { isNetworkError } from 'shared/api/client';
import { AUTH_STATUS, SESSION_MODE, UNAUTH_REASON } from 'store/authConstants';
import { selectAuthStatus, selectSessionMode } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUiPrefsStore } from 'store/ui-prefs';
import { useUsersStore } from 'store/users-store';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const sessionMode = useAuthStore(selectSessionMode);
    // Offline or backend down: the session check waits for connectivity instead of signing out.
    const isDisconnected = useConnectivityStore(state => state.mode !== 'online');
    const isOffline = useConnectivityStore(state => state.mode === 'offline');
    const setDefaultAppMode = useUiPrefsStore(state => state.setDefaultAppMode);
    const fetchSetGroups = useGroupsStore(s => s.fetchSetGroups);
    const { fetchSetUser, invalidateKnownUsers, hasCachedUser, hasCachedUserId } = useUsersStore(
        useShallow(state => ({
            fetchSetUser: state.fetchSetUser,
            invalidateKnownUsers: state.invalidateKnownUsers,
            hasCachedUser: state.localUser !== null,
            hasCachedUserId: state.localUser?.id !== undefined,
        })),
    );
    const setAuthenticated = useAuthStore(s => s.setAuthenticated);
    const setOfflineCachedSession = useAuthStore(s => s.setOfflineCachedSession);
    const setUnauthenticated = useAuthStore(s => s.setUnauthenticated);
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

    // `switchedUser`: the refresh found another user (§1.5, the refresh listener dropped the cached
    // one), so that user's default app mode applies as for a fresh sign-in.
    const loadSessionData = useCallback(
        (switchedUser = false) =>
            Promise.all([
                fetchSetGroups(),
                fetchSetUser().then(user => {
                    if (user && (switchedUser || !hasCachedUser)) {
                        setDefaultAppMode(user.settings.soloModeByDefault);
                    }
                }),
                invalidateKnownUsers({ joinRunning: true }),
            ]).then(() => undefined),
        [fetchSetGroups, fetchSetUser, hasCachedUser, invalidateKnownUsers, setDefaultAppMode],
    );

    useEffect(() => {
        if (location.pathname === ROUTES.OAUTH_CALLBACK || status !== AUTH_STATUS.UNKNOWN) {
            return;
        }

        if (!hasAuthSessionHint()) {
            setUnauthenticated(UNAUTH_REASON.MISSING);
            return;
        }

        if (isDisconnected) {
            // Offline cold start (spec 03 §1.6): a refresh cannot reach the server, so a cached user
            // with a session hint goes straight to the cache. Backend down keeps waiting.
            if (isOffline && hasCachedUserId) {
                setOfflineCachedSession();
            }
            return;
        }

        const cachedIdBefore = useUsersStore.getState().localUser?.id;
        refreshAuthTokens()
            .then(() => {
                setAuthenticated();
                return loadSessionData(
                    cachedIdBefore !== undefined &&
                        useUsersStore.getState().localUser?.id !== cachedIdBefore,
                );
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
            });
    }, [
        hasCachedUserId,
        isDisconnected,
        isOffline,
        loadSessionData,
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setOfflineCachedSession,
        setUnauthenticated,
        status,
    ]);

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
        const cachedIdBefore = useUsersStore.getState().localUser?.id;
        refreshAuthTokens()
            .then(() => loadSessionData(useUsersStore.getState().localUser?.id !== cachedIdBefore))
            .catch(() => {
                // A 401 has already expired the session; a network error keeps the cached
                // session, and the next reconnect (a connectivity change) tries again.
            })
            .finally(() => {
                isReconnecting.current = false;
            });
    }, [isDisconnected, loadSessionData, refreshAuthTokens, sessionMode, status]);
};
