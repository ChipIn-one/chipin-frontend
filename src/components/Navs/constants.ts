import { LucideChartBar, LucideChartPie, LucideSettings } from 'lucide-react';

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
        label: 'Settings',
        href: ROUTES.SETTINGS,
        Icon: LucideSettings,
    },
];
