import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { getAuthTokens } from 'helpers/localStorage';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/usersStore';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const { fetchSetDashboardData } = useDashboardStore();
    const { fetchSetUser, fetchSetFriends } = useUsersStore();
    const { setAuthenticated, setUnauthenticated } = useAuthStore();
    const refreshAuthTokens = useAuthStore(s => s.refreshAuthTokens);

    useEffect(() => {
        if (location.pathname === ROUTES.OAUTH_CALLBACK || status !== 'unknown') {
            return;
        }

        const run = async () => {
            if (!getAuthTokens()) {
                setUnauthenticated('missing');
                return;
            }

            await refreshAuthTokens();
            setAuthenticated();
            fetchSetDashboardData();
            fetchSetUser();
            fetchSetFriends();
        };

        run().catch(() => {
            if (useAuthStore.getState().status !== 'unauthenticated') {
                setUnauthenticated('error');
            }
        });
    }, [
        fetchSetDashboardData,
        fetchSetFriends,
        fetchSetUser,
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setUnauthenticated,
        status,
    ]);
};
