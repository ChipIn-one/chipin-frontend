import { lazy, type ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

import PageLoader from 'basics/PageLoader';
import { InternalPageLayout } from 'components/internal-page-layout';
import GroupJoinPage from 'pages/GroupJoinPage';
import { OAuthCallbackPage } from 'pages/oauth-callback-page';
import SignInPage from 'pages/SignInPage';

import HomeRouteGuard from './HomeRouteGuard';
import { ProtectedRoute } from './ProtectedRoute';
import SoloRouteGuard from './SoloRouteGuard';

const HomePage = lazy(() => import('pages/HomePage'));
const DashboardPage = lazy(() => import('pages/DashboardPage'));
const SoloPage = lazy(() =>
    import('pages/solo-page').then(module => ({
        default: module.SoloPage,
    })),
);
const GroupPage = lazy(() => import('pages/group-page'));
const ActivityPage = lazy(() => import('pages/ActivityPage'));
const ActivitySubeventsPage = lazy(() =>
    import('pages/activity-subevents-page').then(module => ({
        default: module.ActivitySubeventsPage,
    })),
);
const FriendsPage = lazy(() => import('pages/friends-page/'));
const SettingsPage = lazy(() => import('pages/settings-page/'));
const Page404 = lazy(() => import('pages/404-page'));

const InternalRoute = ({ children }: { children: ReactNode }) => (
    <ProtectedRoute>
        <InternalPageLayout>{children}</InternalPageLayout>
    </ProtectedRoute>
);

const AppRouter = () => {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route
                    path={ROUTES.HOME}
                    element={
                        <HomeRouteGuard>
                            <HomePage />
                        </HomeRouteGuard>
                    }
                />
                <Route path={ROUTES.SIGN_IN} element={<SignInPage />} />
                <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallbackPage />} />
                <Route
                    path={ROUTES.DASHBOARD}
                    element={
                        <InternalRoute>
                            <DashboardPage />
                        </InternalRoute>
                    }
                />
                <Route
                    path={ROUTES.SOLO}
                    element={
                        <InternalRoute>
                            <SoloRouteGuard>
                                <SoloPage />
                            </SoloRouteGuard>
                        </InternalRoute>
                    }
                />
                {/* TODO MAYBE MERGE GROUP AND JOIN GROUP PAGES (LINK TO PARAM?) */}
                <Route
                    path={`${ROUTES.GROUP}/:groupId`}
                    element={
                        <InternalRoute>
                            <GroupPage />
                        </InternalRoute>
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
                        <InternalRoute>
                            <ActivityPage />
                        </InternalRoute>
                    }
                />
                <Route
                    path={`${ROUTES.ACTIVITY}/:parentActivityId`}
                    element={
                        <InternalRoute>
                            <ActivitySubeventsPage />
                        </InternalRoute>
                    }
                />
                <Route
                    path={ROUTES.FRIENDS}
                    element={
                        <InternalRoute>
                            <FriendsPage />
                        </InternalRoute>
                    }
                />
                <Route
                    path={ROUTES.SETTINGS}
                    element={
                        <InternalRoute>
                            <SettingsPage />
                        </InternalRoute>
                    }
                />
                <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
                <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
            </Routes>
        </Suspense>
    );
};

export default AppRouter;
