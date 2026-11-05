import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { markAuthSessionSignedOut, subscribeToRemoteAuthLogout } from 'helpers/authSession';
import { hasAuthSessionHint } from 'helpers/localStorage';
import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    // Offline or backend down: the session check waits for connectivity instead of signing out.
    const isDisconnected = useConnectivityStore(state => state.mode !== 'online');
    const { fetchSetDashboardData, setDefaultAppMode } = useDashboardStore(
        useShallow(state => ({
            fetchSetDashboardData: state.fetchSetDashboardData,
            setDefaultAppMode: state.setDefaultAppMode,
        })),
    );
    const fetchSetGroups = useGroupsStore(s => s.fetchSetGroups);
    const { fetchSetUser, fetchSetFriends, hasCachedUser } = useUsersStore(
        useShallow(state => ({
            fetchSetUser: state.fetchSetUser,
            fetchSetFriends: state.fetchSetFriends,
            hasCachedUser: state.localUser !== null,
        })),
    );
    const setAuthenticated = useAuthStore(s => s.setAuthenticated);
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

    useEffect(() => {
        if (
            location.pathname === ROUTES.OAUTH_CALLBACK ||
            status !== AUTH_STATUS.UNKNOWN ||
            isDisconnected
        ) {
            return;
        }

        if (!hasAuthSessionHint()) {
            setUnauthenticated(UNAUTH_REASON.MISSING);
            return;
        }

        refreshAuthTokens()
            .then(() => {
                setAuthenticated();
                return Promise.all([
                    fetchSetDashboardData(),
                    fetchSetGroups(),
                    fetchSetUser().then(user => {
                        if (user && !hasCachedUser) {
                            setDefaultAppMode(user.settings.soloModeByDefault);
                        }
                    }),
                    fetchSetFriends(),
                ]).then(() => undefined);
            })
            .catch(() => {
                if (useConnectivityStore.getState().mode !== 'online') {
                    return;
                }

                if (useAuthStore.getState().status === AUTH_STATUS.UNKNOWN) {
                    setUnauthenticated(UNAUTH_REASON.ERROR);
                }
            });
    }, [
        fetchSetDashboardData,
        fetchSetFriends,
        fetchSetGroups,
        fetchSetUser,
        hasCachedUser,
        isDisconnected,
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setDefaultAppMode,
        setUnauthenticated,
        status,
    ]);
};
