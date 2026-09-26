import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { getAuthTokens } from 'helpers/localStorage';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
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
        if (location.pathname === ROUTES.OAUTH_CALLBACK || status !== 'unknown') {
            return;
        }

        if (!getAuthTokens()) {
            setUnauthenticated('missing');
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
                if (useAuthStore.getState().status === 'unknown') {
                    setUnauthenticated('error');
                }
            });
    }, [
        fetchSetDashboardData,
        fetchSetFriends,
        fetchSetGroups,
        fetchSetUser,
        hasCachedUser,
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setDefaultAppMode,
        setUnauthenticated,
        status,
    ]);
};
