// App route manifest (spec 04 §2.2): pure data. Only type imports and erasable syntax, so that a
// Node 24 script can import this file with type stripping and no build.
//
// Not here yet: `home` (the index redirect to the preferred mode) lands in 04-5a; it has no page
// today. Until 04-5a the index is the transitional `publicHome`.

type RouteAccess = 'public' | 'protected';
// `internal` = InternalPageLayout with navigation; `public` is for the transitional ids only.
type RouteLayout = 'internal' | 'bare' | 'public';

type AppRouteId =
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
    | 'notFound'
    | 'publicHome'
    | 'publicPrivacy'
    | 'publicTerms';

interface AppRouteDef {
    id: AppRouteId;
    /** Relative to the router root, no leading slash: `group/:groupId`. */
    path: string;
    access: RouteAccess;
    layout: RouteLayout;
    /** An additional layout guard. */
    guard?: 'solo';
    /** Keys of the `meta` namespace. */
    meta: { titleKey: string; entityTitleKey?: string };
    /** Paths on chipin.one redirected to app.chipin.one (§4.2); read only by the config tests. */
    legacyPaths: readonly string[];
    /** A transitional public route; removed in 04-5a. */
    transitional?: true;
    /** The path is repeated under every LOCALE_PREFIX prefix. */
    localePrefix?: true;
}

const APP_ROUTES: readonly AppRouteDef[] = [
    {
        // 04-2f: the sign-in screen (`?returnTo`, `?locale`); `requireSession` and the site lead here.
        id: 'login',
        path: 'login',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'login.title' },
        legacyPaths: ['/login'],
    },
    {
        id: 'oauthCallback',
        path: 'oauth/callback',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'oauthCallback.title' },
        legacyPaths: ['/oauth/callback'],
    },
    {
        id: 'dashboard',
        path: 'dashboard',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'dashboard.title' },
        legacyPaths: ['/dashboard'],
    },
    {
        id: 'solo',
        path: 'solo',
        access: 'protected',
        layout: 'internal',
        guard: 'solo',
        meta: { titleKey: 'solo.title' },
        legacyPaths: ['/solo'],
    },
    {
        id: 'group',
        path: 'group/:groupId',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'group.title', entityTitleKey: 'group.titleWithName' },
        legacyPaths: ['/group/:groupId'],
    },
    {
        id: 'groupJoin',
        path: 'group/join/:inviteToken',
        access: 'protected',
        layout: 'bare',
        meta: { titleKey: 'groupJoin.title' },
        legacyPaths: [],
    },
    {
        id: 'activity',
        path: 'activity',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'activity.title' },
        legacyPaths: ['/activity'],
    },
    {
        id: 'activityDetails',
        path: 'activity/:parentActivityId',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'activityDetails.title' },
        legacyPaths: ['/activity/:parentActivityId'],
    },
    {
        id: 'friends',
        path: 'friends',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'friends.title' },
        legacyPaths: ['/friends'],
    },
    {
        id: 'friendJoin',
        path: 'friends/join/:inviteToken',
        access: 'protected',
        layout: 'bare',
        // As ROUTE_META today: the meta namespace has no friend-join key.
        meta: { titleKey: 'friends.title' },
        legacyPaths: [],
    },
    {
        id: 'settings',
        path: 'settings',
        access: 'protected',
        layout: 'internal',
        meta: { titleKey: 'settings.title' },
        legacyPaths: ['/settings'],
    },
    {
        id: 'notFound',
        path: 'not-found',
        access: 'public',
        layout: 'bare',
        meta: { titleKey: 'notFound.title' },
        legacyPaths: [],
    },
    {
        id: 'publicHome',
        path: '',
        access: 'public',
        layout: 'public',
        meta: { titleKey: 'home.title' },
        legacyPaths: [],
        transitional: true,
        localePrefix: true,
    },
    {
        id: 'publicPrivacy',
        path: 'privacy',
        access: 'public',
        layout: 'public',
        meta: { titleKey: 'privacy.title' },
        legacyPaths: [],
        transitional: true,
        localePrefix: true,
    },
    {
        id: 'publicTerms',
        path: 'terms',
        access: 'public',
        layout: 'public',
        meta: { titleKey: 'terms.title' },
        legacyPaths: [],
        transitional: true,
        localePrefix: true,
    },
];

export { APP_ROUTES };
export type { AppRouteDef, AppRouteId, RouteAccess, RouteLayout };
