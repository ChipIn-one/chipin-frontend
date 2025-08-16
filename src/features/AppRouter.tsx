import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

const AuthCallbackPage = lazy(
    () => import(/* webpackChunkName: "LegalPage" */ 'pages/AuthCallbackPage'),
);
const BalancesPage = lazy(
    () => import(/* webpackChunkName: "BalancesPage" */ 'pages/BalancesPage'),
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ 'pages/HomePage'));
const Page404 = lazy(() => import(/* webpackChunkName: "Page404" */ 'pages/Page404'));

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isLoggedIn } = useAuthStore();

    if (!isLoggedIn) {
        toast.warning('You must be logged in to access this page');
        return <Navigate to={ROUTES.HOME} replace />;
    }
    return <>{children}</>;
};

const AppRouter = () => {
    return (
        <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route
                path={ROUTES.BALANCES}
                element={
                    <ProtectedRoute>
                        <BalancesPage />
                    </ProtectedRoute>
                }
            />
            <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallbackPage />} />
            <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
        </Routes>
    );
};

export default AppRouter;
