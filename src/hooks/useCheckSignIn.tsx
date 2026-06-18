import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { checkTokenValidity } from 'store/IDB/auth';
import { useUsersStore } from 'store/usersStore';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const { fetchSetDashboardData } = useDashboardStore();
    const { fetchSetUser, fetchSetFriends } = useUsersStore();
    const { setAuthenticated, setUnauthenticated } = useAuthStore();

    useEffect(() => {
        if (location.pathname === ROUTES.OAUTH_CALLBACK || status !== 'unknown') {
            return;
        }

        const run = async () => {
            const result = await checkTokenValidity();
            if (result.valid) {
                setAuthenticated();
                fetchSetDashboardData();
                fetchSetUser();
                fetchSetFriends();
            } else {
                setUnauthenticated(result.reason);
            }
        };

        run().catch(() => {
            setUnauthenticated('error');
        });
    }, [
        fetchSetDashboardData,
        fetchSetFriends,
        fetchSetUser,
        location.pathname,
        setAuthenticated,
        setUnauthenticated,
        status,
    ]);
};
