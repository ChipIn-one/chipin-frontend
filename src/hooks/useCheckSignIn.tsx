import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { checkTokenValidity, saveAuthTokenDB } from 'store/IDB/auth';

export const useCheckSignIn = () => {
    const { fetchSetDashboardData } = useDashboardStore();
    const { setAuthenticated, setUnauthenticated } = useAuthStore();

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const run = async () => {
            const authToken = searchParams.get('jwtAuthToken');
            const error = searchParams.get('jwtAuthError');

            // 1) If came back from OAuth with token - save and authenticate
            if (authToken) {
                await saveAuthTokenDB(authToken);
                setAuthenticated();
                fetchSetDashboardData();

                // Remove query params, stay on same path (important for join links)
                navigate(window.location.pathname, { replace: true });
                return;
            }

            if (error) {
                // This is not auth status yet, but at least mark unauth (no redirect)
                setUnauthenticated('error');
                return;
            }

            // 2) Otherwise check token in IDB
            const result = await checkTokenValidity();
            if (result.valid) {
                setAuthenticated();
                fetchSetDashboardData();
            } else {
                setUnauthenticated(result.reason);
            }
        };

        run().catch(() => {
            setUnauthenticated('error');
        });
    }, []);
};
