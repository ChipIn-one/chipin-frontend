// App route manifest (spec 04 §2.2): pure data. Only type imports and erasable syntax, so that a
// Node 24 script can import this file with type stripping and no build.

type RouteAccess = 'public' | 'protected';
// `internal` = InternalPageLayout with navigation.
type RouteLayout = 'internal' | 'bare';

type AppRouteId =
    | 'home'
    | 'login'
    | 'oauthCallback'
    | 'dashboard'
    | 'solo'
    | 'group'
    | 'groupJoin'
    | 'activity'
    | 'activityDetails'
    | 'friends'
    | 'friendJoin'
    | 'settings'
    | 'notFound';

interface AppRouteDef {
    id: AppRouteId;
    /** Relative to the router root, no leading slash: `group/:groupId`; `''` is the index. */
    path: string;
    access: RouteAccess;
    layout: RouteLayout;
    /** An additional layout guard. */
    guard?: 'solo';
    /** Keys of the `meta` namespace. */
    meta: { titleKey: string; entityTitleKey?: string };
}

const APP_ROUTES: readonly AppRouteDef[] = [
    {
        // 04-5a: the index; its loader redirects to the preferred mode (dashboard or Solo).
        id: 'home',
        path: '',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'dashboard.title' },
    },
    {
        // 04-2f: the sign-in screen (`?returnTo`, `?locale`); `requireSession` and the site lead here.
        id: 'login',
        path: 'login',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'login.title' },
    },
    {
        id: 'oauthCallback',
        path: 'oauth/callback',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'oauthCallback.title' },
    },
    {
        id: 'dashboard',
        path: 'dashboard',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'dashboard.title' },
    },
    {
        id: 'solo',
        path: 'solo',
        access: 'protected',
        layout: 'internal',
        guard: 'solo',
        meta: { titleKey: 'solo.title' },
    },
    {
        id: 'group',
        path: 'group/:groupId',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'group.title', entityTitleKey: 'group.titleWithName' },
    },
    {
        id: 'groupJoin',
        path: 'group/join/:inviteToken',
        access: 'protected',
        layout: 'bare',
        meta: { titleKey: 'groupJoin.title' },
    },
    {
        id: 'activity',
        path: 'activity',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'activity.title' },
    },
    {
        id: 'activityDetails',
        path: 'activity/:parentActivityId',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'activityDetails.title' },
    },
    {
        id: 'friends',
        path: 'friends',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'friends.title' },
    },
    {
        id: 'friendJoin',
        path: 'friends/join/:inviteToken',
        access: 'protected',
        layout: 'bare',
        // As ROUTE_META today: the meta namespace has no friend-join key.
        meta: { titleKey: 'friends.title' },
    },
    {
        id: 'settings',
        path: 'settings',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'settings.title' },
    },
    {
        id: 'notFound',
        path: 'not-found',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'notFound.title' },
    },
];

export { APP_ROUTES };
export type { AppRouteDef, AppRouteId, RouteAccess, RouteLayout };
