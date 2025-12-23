import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { saveAuthTokenDB } from 'store/IDB/auth';

const AuthCallbackPage = () => {
    const { fetchSetDashboardData } = useDashboardStore();
    const { setIsLoggedIn } = useAuthStore();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const authToken = searchParams.get('token');
        const error = searchParams.get('error');

        if (authToken) {
            saveAuthTokenDB(authToken).then(() => {
                setIsLoggedIn(true);
                navigate(ROUTES.DASHBOARD, { replace: true });
                fetchSetDashboardData();
            });
        } else {
            console.error('OAuth error:', error);
            navigate(ROUTES.HOME, { replace: true });
        }
    }, [searchParams, setIsLoggedIn, navigate, fetchSetDashboardData]);

    return null;
};

export default AuthCallbackPage;
