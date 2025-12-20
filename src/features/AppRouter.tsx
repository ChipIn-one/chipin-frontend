import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';

import { MESSAGES } from 'constants/messages';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';
import AuthCallbackPage from 'pages/AuthCallbackPage';
import GroupJoinPage from 'pages/GroupJoinPage';
import SignInPage from 'pages/SignInPage';

const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ 'pages/HomePage'));
const DashboardPage = lazy(
    () => import(/* webpackChunkName: "DashboardPage" */ 'pages/DashboardPage'),
);
const GroupPage = lazy(() => import(/* webpackChunkName: "GroupPage" */ 'pages/GroupPage'));
const ActivityPage = lazy(
    () => import(/* webpackChunkName: "ActivityPage" */ 'pages/ActivityPage'),
);
const SettingsPage = lazy(
    () => import(/* webpackChunkName: "SettingsPage" */ 'pages/SettingsPage'),
);
const Page404 = lazy(() => import(/* webpackChunkName: "Page404" */ 'pages/Page404'));

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isLoggedIn } = useAuthStore();

    if (!isLoggedIn) {
        console.log('User not logged in, redirecting to sign-in page');
        toast.warning(MESSAGES.warning.auth.MUST_BE_LOGGED_IN);
        return <Navigate to={ROUTES.SIGN_IN} />;
    }

    return <>{children}</>;
};

const AppRouter = () => {
    const { isAuthChecked } = useAuthStore();

    if (!isAuthChecked) {
        return <PageLoader />;
    }

    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path={ROUTES.HOME} element={<HomePage />} />
                <Route path={ROUTES.SIGN_IN} element={<SignInPage />} />
                <Route
                    path={ROUTES.DASHBOARD}
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path={`${ROUTES.GROUP}/:groupId`}
                    element={
                        <ProtectedRoute>
                            <GroupPage />
                        </ProtectedRoute>
                    }
                />
                <Route path={`${ROUTES.GROUP_JOIN}/:inviteToken`} element={<GroupJoinPage />} />
                <Route
                    path={ROUTES.ACTIVITY}
                    element={
                        <ProtectedRoute>
                            <ActivityPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path={ROUTES.SETTINGS}
                    element={
                        <ProtectedRoute>
                            <SettingsPage />
                        </ProtectedRoute>
                    }
                />
                <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallbackPage />} />
                <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
                {/* 404 fallback */}
                <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
            </Routes>
        </Suspense>
    );
};

export default AppRouter;
