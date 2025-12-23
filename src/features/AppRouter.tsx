import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Box } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';
import GroupJoinPage from 'pages/GroupJoinPage';
import SignInPage from 'pages/SignInPage';

const HomePage = lazy(() => import('pages/HomePage'));
const DashboardPage = lazy(() => import('pages/DashboardPage'));
const GroupPage = lazy(() => import('pages/GroupPage'));
const ActivityPage = lazy(() => import('pages/ActivityPage'));
const SettingsPage = lazy(() => import('pages/SettingsPage'));
const Page404 = lazy(() => import('pages/Page404'));

interface Props {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    if (!isAuthResolved) {
        return <PageLoader />;
    }

    if (!isLoggedIn) {
        return <SignInPage />;
    }

    return (
        <Box pt="8" pb="8">
            {children}
        </Box>
    );
};

const AppRouter = () => {
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

                <Route
                    path={`${ROUTES.GROUP_JOIN}/:inviteToken`}
                    element={
                        <ProtectedRoute>
                            <GroupJoinPage />
                        </ProtectedRoute>
                    }
                />

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

                <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
                <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
            </Routes>
        </Suspense>
    );
};

export default AppRouter;
