import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { saveAuthTokenDB } from 'store/IDB/auth';

const AuthCallbackPage = () => {
    const { setIsLoggedIn } = useAuthStore();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const authToken = searchParams.get('token');
        const error = searchParams.get('error');

        if (authToken) {
            console.log('OAuth token received:', authToken);
            saveAuthTokenDB(authToken);
            setIsLoggedIn(true);

            navigate(ROUTES.BALANCES);
        } else {
            console.error('OAuth error:', error);
            navigate(ROUTES.HOME);
        }
    }, [searchParams, navigate]);

    return null;
};

export default AuthCallbackPage;
