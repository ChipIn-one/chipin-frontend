import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { checkAndRemoveExpiredToken } from 'store/IDB/auth';

import AuthCallbackPage from './AuthCallbackPage';
import BalancesPage from './BalancesPage';
import HomePage from './HomePage';
import Page404 from './Page404';

export const AppRouter = () => {
    const navigate = useNavigate();

    const { setIsLoggedIn } = useAuthStore();

    useEffect(() => {
        checkAndRemoveExpiredToken().then(isValid => {
            if (!isValid) {
                navigate(ROUTES.HOME);
                setIsLoggedIn(false);
            } else {
                setIsLoggedIn(true);
            }
        });
    }, []);

    return (
        <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.BALANCES} element={<BalancesPage />} />
            <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallbackPage />} />
            <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
        </Routes>
    );
};
