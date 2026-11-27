import type { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { requireSession } from 'app/auth/requireSession';
import { ROUTES } from 'constants/routes';
import { GuardLoader } from 'features/routing';

import { PageLoader } from 'basics/PageLoader';

import { AuthLayout } from './AuthLayout';
import { homeLoader } from './homeLoader';
import { BareLayout, InternalLayout } from './InternalLayout';
import { RootLayout } from './RootLayout';
import { RootErrorBoundary, RouteErrorView } from './RouteErrorView';
import { APP_ROUTES, type AppRouteDef } from './routeManifest';
import { ROUTE_MODULES } from './routeModules';
import { SoloGuardLayout, soloGuardLoader } from './SoloGuardLayout';

/** The `handle` of a leaf route: what `useDocumentTitle` reads (spec 04 §2.6). */
interface RouteHandle {
    meta: AppRouteDef['meta'];
}

const leaf = (route: AppRouteDef): RouteObject => {
    const common = {
        id: route.id,
        lazy: ROUTE_MODULES[route.id],
        handle: { meta: route.meta } satisfies RouteHandle,
    };

    // The manifest's `''` is the index route.
    return route.path === '' ? { ...common, index: true } : { ...common, path: route.path };
};

const byLayout = (access: AppRouteDef['access'], layout: AppRouteDef['layout']) =>
    APP_ROUTES.filter(route => route.access === access && route.layout === layout);

const internalRoutes = APP_ROUTES.filter(route => route.layout === 'internal');

// A lazy route on the first load renders the `hydrateFallbackElement` of its closest ancestor that
// has one, in place of that ancestor (react-router 7.18 `_renderMatches`). With the fallback only on
// the root, the whole shell (header included) would be replaced by the spinner. So every child of
// the root carries it too: the root keeps rendering `RootLayout`, and the spinner appears in its
// `<Outlet/>`, as the `<Suspense fallback={<PageLoader/>}>` around `<Routes>` did before.
const withPageFallback = (route: RouteObject): RouteObject => ({
    ...route,
    hydrateFallbackElement: route.hydrateFallbackElement ?? <PageLoader />,
});

/**
 * The app route tree (spec 04 §2.3), 1:1 with the former `AppRouter`. The protected routes sit under
 * `AuthLayout` (loader `requireSession`), Solo also under `SoloGuardLayout`; `queryClient` is the
 * client of this router (one router per user client, `AppRouterProvider`).
 */
const buildAppRoutes = (queryClient: QueryClient): RouteObject[] => [
    {
        path: '/',
        element: <RootLayout />,
        errorElement: <RootErrorBoundary />,
        hydrateFallbackElement: <PageLoader />,
        children: [
            ...byLayout('public', 'bare').map(leaf),
            {
                id: 'auth',
                element: <AuthLayout />,
                loader: requireSession,
                // While the loader waits for the session (up to 5 s): offline the banner with its
                // Retry above the loader, as `AuthLayout` shows after; online the same PageLoader.
                hydrateFallbackElement: <GuardLoader />,
                // For the bare join routes and the `requireSession` loader (C2-32).
                errorElement: <RouteErrorView />,
                children: [
                    {
                        element: <BareLayout />,
                        children: byLayout('protected', 'bare').map(leaf),
                    },
                    {
                        element: <InternalLayout />,
                        children: [
                            {
                                // A pathless child, so the boundary renders inside `InternalLayout`
                                // (header and navigation stay): the `errorElement` of the layout
                                // route itself would replace the layout.
                                errorElement: <RouteErrorView />,
                                children: internalRoutes.map(route => {
                                    if (route.guard === 'solo') {
                                        return {
                                            element: <SoloGuardLayout />,
                                            loader: soloGuardLoader(queryClient),
                                            children: [leaf(route)],
                                        };
                                    }
                                    // 04-5a: `/` redirects to the preferred mode (it replaces
                                    // `PublicHomeGuard`).
                                    return route.id === 'home'
                                        ? { ...leaf(route), loader: homeLoader(queryClient) }
                                        : leaf(route);
                                }),
                            },
                        ],
                    },
                ],
            },
            { path: '*', element: <Navigate to={ROUTES.NOT_FOUND_404} /> },
        ].map(withPageFallback),
    },
];

/** No `basename` (spec 04 §2.1, D26): the app lives at the root of its host. */
const createAppRouter = (queryClient: QueryClient) =>
    createBrowserRouter(buildAppRoutes(queryClient));

export { buildAppRoutes, createAppRouter };
