import { LucideChartBar, LucideChartPie, LucideSettings, LucideUsers } from 'lucide-react';

import { ROUTES } from 'constants/routes';

export const NAV_ELEMENTS = [
    {
        label: 'Dashboard',
        href: ROUTES.DASHBOARD,
        Icon: LucideChartPie,
    },
    {
        label: 'Activity',
        href: ROUTES.ACTIVITY,
        Icon: LucideChartBar,
    },
    {
        label: 'Friends',
        href: ROUTES.FRIENDS,
        Icon: LucideUsers,
    },
    {
        label: 'Settings',
        href: ROUTES.SETTINGS,
        Icon: LucideSettings,
    },
];
