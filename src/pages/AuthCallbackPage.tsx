import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

const AuthCallbackPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const authToken = searchParams.get('token');
        const error = searchParams.get('error');

        if (authToken) {
            localStorage.setItem('auth_token', authToken);
            navigate(ROUTES.BALANCES);
        } else {
            console.error('OAuth error:', error);
            navigate(ROUTES.HOME);
        }
    }, [searchParams, navigate]);

    return null;
};

export default AuthCallbackPage;
