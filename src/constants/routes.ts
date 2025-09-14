export const ROUTES = {
    HOME: '/',
    NOT_FOUND_404: '/not-found',
    SIGN_IN: '/sign-in',
    AUTH_CALLBACK: '/auth/callback',
    BALANCES: '/balances',
    GROUPS: '/groups',
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
    [ROUTES.GROUPS]: {
        title: 'ChipIn — Groups',
        description: 'View and manage your groups',
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
