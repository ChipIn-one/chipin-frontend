import type { LucideIcon } from 'lucide-react';
import { LucideChartBar, LucideChartPie, LucideSettings, LucideUsers } from 'lucide-react';

import { ROUTES } from 'constants/routes';

interface NavElement {
    labelKey: string;
    href: string;
    Icon: LucideIcon;
}

const getNavElements = (homeRoute: string): NavElement[] => [
    {
        labelKey: 'nav.dashboard',
        href: homeRoute,
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

export { getNavElements, type NavElement };
