export const ROUTES = {
    HOME: '/',
    NOT_FOUND_404: '/not-found',
    SIGN_IN: '/sign-in',
    AUTH_CALLBACK: '/auth/callback',
    BALANCES: '/balances',
    GROUP: '/group',
    ACTIVITY: '/activity',
    SETTINGS: '/settings',
};

export const HEAD_META: Record<string, { title: string; description?: string }> = {
    [ROUTES.HOME]: {
        title: 'ChipIn — Home',
        description: 'Home page of the ChipIn app',
    },
    [ROUTES.SIGN_IN]: {
        title: 'ChipIn — Sign In',
        description: 'Sign in to your ChipIn account',
    },
    [ROUTES.BALANCES]: {
        title: 'ChipIn — Balances',
        description: 'View and manage your balances',
    },
    [ROUTES.GROUP]: {
        title: 'ChipIn — Group',
        description: 'View and manage your group',
    },
    [ROUTES.ACTIVITY]: {
        title: 'ChipIn — Activity',
        description: 'View your recent activity',
    },
    [ROUTES.SETTINGS]: {
        title: 'ChipIn — Settings',
        description: 'Manage your settings',
    },
    [ROUTES.NOT_FOUND_404]: {
        title: 'ChipIn — Page Not Found',
        description: 'The page you are looking for does not exist',
    },
};

export const BREADCRUMBS = {
    [ROUTES.BALANCES]: {
        title: 'Balances',
        description: 'Overview of your balances',
    },
    [ROUTES.GROUP]: {
        title: 'Group',
        description: 'Manage your group',
    },
    [ROUTES.ACTIVITY]: {
        title: 'Activity',
        description: 'Your recent activity',
    },
    [ROUTES.SETTINGS]: {
        title: 'Settings',
        description: 'Manage your account preferences and settings',
    },
};
