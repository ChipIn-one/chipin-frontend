import type { ComponentType } from 'react';
import type { LoaderFunction } from 'react-router-dom';

import type { AppRouteId } from './routeManifest';

/** A route module in the React Router 7 `lazy` shape: named exports only. */
interface RouteModule {
    Component: ComponentType;
    loader?: LoaderFunction;
    ErrorBoundary?: ComponentType;
}

// Lazy route modules (spec 04 §2.2), one chunk per route. A page folder slice keeps its `route.ts`
// next to the page; a flat page file (`pages/DashboardPage.tsx`) gets it under `./routes/<id>/`,
// because a new `pages/*` file or folder is another pages slice and pages cannot import pages.
const ROUTE_MODULES = {
    login: () => import('pages/login-page/route'),
    oauthCallback: () => import('pages/oauth-callback-page/route'),
    dashboard: () => import('./routes/dashboard/route'),
    solo: () => import('pages/solo-page/route'),
    group: () => import('pages/group-page/route'),
    groupJoin: () => import('./routes/groupJoin/route'),
    activity: () => import('./routes/activity/route'),
    activityDetails: () => import('pages/activity-subevents-page/route'),
    friends: () => import('pages/friends-page/route'),
    friendJoin: () => import('./routes/friendJoin/route'),
    settings: () => import('pages/settings-page/route'),
    notFound: () => import('pages/404-page/route'),
    publicHome: () => import('./routes/publicHome/route'),
    publicPrivacy: () => import('./routes/publicPrivacy/route'),
    publicTerms: () => import('./routes/publicTerms/route'),
} satisfies Record<AppRouteId, () => Promise<RouteModule>>;

export { ROUTE_MODULES };
export type { RouteModule };
