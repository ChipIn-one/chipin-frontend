import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { selectAuthStatus, selectRefreshAuthTokens } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { AUTH_SESSION_EXPIRED_EVENT, checkTokenValidity } from 'store/IDB/auth';
import { useUsersStore } from 'store/usersStore';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const { fetchSetDashboardData } = useDashboardStore();
    const { fetchSetUser, fetchSetFriends } = useUsersStore();
    const { setAuthenticated, setUnauthenticated } = useAuthStore();
    const refreshAuthTokens = useAuthStore(selectRefreshAuthTokens);

    useEffect(() => {
        const handleAuthSessionExpired = () => {
            setUnauthenticated('expired');
        };

        window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);

        return () => {
            window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);
        };
    }, [setUnauthenticated]);

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
            } else if (result.reason === 'expired') {
                try {
                    await refreshAuthTokens();
                    fetchSetDashboardData();
                    fetchSetUser();
                    fetchSetFriends();
                } catch {
                    // The auth store already clears tokens and sets the expired state.
                }
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
        refreshAuthTokens,
        setAuthenticated,
        setUnauthenticated,
        status,
    ]);
};
