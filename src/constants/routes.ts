export const ROUTES = {
    HOME: '/',
    NOT_FOUND_404: '/not-found',
    SIGN_IN: '/sign-in',
    OAUTH_CALLBACK: '/oauth/callback',
    DASHBOARD: '/dashboard',
    SOLO: '/solo',
    GROUP: '/group',
    GROUP_JOIN: '/group/join',
    ACTIVITY: '/activity',
    FRIENDS: '/friends',
    SETTINGS: '/settings',
};

export interface RouteMeta {
    path: string;
    titleKey: string;
    descriptionKey: string;
    groupTitleKey?: string;
    groupDescriptionKey?: string;
}

export const ROUTE_META = [
    {
        path: ROUTES.HOME,
        titleKey: 'home.title',
        descriptionKey: 'home.description',
    },
    {
        path: ROUTES.SIGN_IN,
        titleKey: 'signIn.title',
        descriptionKey: 'signIn.description',
    },
    {
        path: ROUTES.OAUTH_CALLBACK,
        titleKey: 'oauthCallback.title',
        descriptionKey: 'oauthCallback.description',
    },
    {
        path: ROUTES.DASHBOARD,
        titleKey: 'dashboard.title',
        descriptionKey: 'dashboard.description',
    },
    {
        path: ROUTES.SOLO,
        titleKey: 'solo.title',
        descriptionKey: 'solo.description',
    },
    {
        path: `${ROUTES.GROUP}/:groupId`,
        titleKey: 'group.title',
        descriptionKey: 'group.description',
        groupTitleKey: 'group.titleWithName',
        groupDescriptionKey: 'group.descriptionWithName',
    },
    {
        path: `${ROUTES.GROUP_JOIN}/:inviteToken`,
        titleKey: 'groupJoin.title',
        descriptionKey: 'groupJoin.description',
    },
    {
        path: ROUTES.ACTIVITY,
        titleKey: 'activity.title',
        descriptionKey: 'activity.description',
    },
    {
        path: `${ROUTES.ACTIVITY}/:parentActivityId`,
        titleKey: 'activityDetails.title',
        descriptionKey: 'activityDetails.description',
    },
    {
        path: ROUTES.FRIENDS,
        titleKey: 'friends.title',
        descriptionKey: 'friends.description',
    },
    {
        path: ROUTES.SETTINGS,
        titleKey: 'settings.title',
        descriptionKey: 'settings.description',
    },
    {
        path: ROUTES.NOT_FOUND_404,
        titleKey: 'notFound.title',
        descriptionKey: 'notFound.description',
    },
] satisfies RouteMeta[];
