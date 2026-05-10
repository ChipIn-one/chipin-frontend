import { LucideChartBar, LucideChartPie, LucideSettings, LucideUsers } from 'lucide-react';

import { ROUTES } from 'constants/routes';

export const NAV_ELEMENTS = [
    {
        labelKey: 'nav.dashboard',
        href: ROUTES.DASHBOARD,
        Icon: LucideChartPie,
    },
    {
        labelKey: 'nav.activity',
        href: ROUTES.ACTIVITY,
        Icon: LucideChartBar,
    },
    {
        labelKey: 'nav.friends',
        href: ROUTES.FRIENDS,
        Icon: LucideUsers,
    },
    {
        labelKey: 'nav.settings',
        href: ROUTES.SETTINGS,
        Icon: LucideSettings,
    },
];
