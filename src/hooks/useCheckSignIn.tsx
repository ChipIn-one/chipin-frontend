import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getAuthTokens } from 'helpers/localStorage';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/usersStore';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const fetchSetDashboardData = useDashboardStore(s => s.fetchSetDashboardData);
    const fetchSetGroups = useGroupsStore(s => s.fetchSetGroups);
    const fetchSetUser = useUsersStore(s => s.fetchSetUser);
    const fetchSetFriends = useUsersStore(s => s.fetchSetFriends);
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
                fetchSetDashboardData();
                fetchSetGroups().catch(() => undefined);
                fetchSetUser();
                fetchSetFriends();
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
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setUnauthenticated,
        status,
    ]);
};
