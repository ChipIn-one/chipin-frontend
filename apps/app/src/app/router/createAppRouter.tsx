import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';

import { PUBLIC_ROUTE_ENTRIES, type PublicPage } from 'constants/publicRoutes';
import { ROUTES } from 'constants/routes';
import {
    HomeRouteGuard,
    ProtectedRoute,
    PublicLocaleRoute,
    SoloRouteGuard,
} from 'features/routing';

import PageLoader from 'basics/PageLoader';

import { InternalLayout } from './InternalLayout';
import { RootLayout } from './RootLayout';
import { APP_ROUTES, type AppRouteDef, type AppRouteId } from './routeManifest';
import { ROUTE_MODULES } from './routeModules';

// The transitional public ids (spec 04 §2.2) by the public page they render, until 04-5a.
const TRANSITIONAL_ROUTE_IDS: Record<PublicPage, AppRouteId> = {
    home: 'publicHome',
    privacy: 'publicPrivacy',
    terms: 'publicTerms',
};

const leaf = (route: AppRouteDef): RouteObject => ({
    id: route.id,
    path: route.path,
    lazy: ROUTE_MODULES[route.id],
});

const byLayout = (access: AppRouteDef['access'], layout: AppRouteDef['layout']) =>
    APP_ROUTES.filter(
        route => route.access === access && route.layout === layout && !route.transitional,
    );

const internalRoutes = APP_ROUTES.filter(route => route.layout === 'internal');

// A lazy route on the first load renders the `hydrateFallbackElement` of its closest ancestor that
// has one, in place of that ancestor (react-router 7.18 `_renderMatches`). With the fallback only on
// the root, the whole shell (header included) would be replaced by the spinner. So every child of
// the root carries it too: the root keeps rendering `RootLayout`, and the spinner appears in its
// `<Outlet/>`, as the `<Suspense fallback={<PageLoader/>}>` around `<Routes>` did before.
const withPageFallback = (route: RouteObject): RouteObject => ({
    ...route,
    hydrateFallbackElement: <PageLoader />,
});

const publicLocaleRoutes = (): RouteObject[] =>
    PUBLIC_ROUTE_ENTRIES.map(entry => {
        const page: ReactNode =
            entry.page === 'home' ? (
                <HomeRouteGuard>
                    <Outlet />
                </HomeRouteGuard>
            ) : (
                <Outlet />
            );

        return {
            path: entry.path,
            element: <PublicLocaleRoute locale={entry.locale}>{page}</PublicLocaleRoute>,
            children: [{ index: true, lazy: ROUTE_MODULES[TRANSITIONAL_ROUTE_IDS[entry.page]] }],
        };
    });

/**
 * The app route tree (spec 04 §2.3), 1:1 with the former `AppRouter`. Guards are still the
 * component guards; `queryClient` is for the guard loaders of 04-2a2b (no loaders yet, D31).
 */
const buildAppRoutes = (_queryClient: QueryClient): RouteObject[] => [
    {
        path: '/',
        element: <RootLayout />,
        hydrateFallbackElement: <PageLoader />,
        children: [
            ...publicLocaleRoutes(),
            ...byLayout('public', 'bare').map(leaf),
            {
                element: (
                    <ProtectedRoute>
                        <Outlet />
                    </ProtectedRoute>
                ),
                children: byLayout('protected', 'bare').map(leaf),
            },
            {
                element: <InternalLayout />,
                children: internalRoutes.map(route =>
                    route.guard === 'solo'
                        ? {
                              element: (
                                  <SoloRouteGuard>
                                      <Outlet />
                                  </SoloRouteGuard>
                              ),
                              children: [leaf(route)],
                          }
                        : leaf(route),
                ),
            },
            { path: '*', element: <Navigate to={ROUTES.NOT_FOUND_404} /> },
        ].map(withPageFallback),
    },
];

/** No `basename` (spec 04 §2.1, D26): the app lives at the root of its host. */
const createAppRouter = (queryClient: QueryClient) =>
    createBrowserRouter(buildAppRoutes(queryClient));

export { buildAppRoutes, createAppRouter };
