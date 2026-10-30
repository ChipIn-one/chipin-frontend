import type { LucideIcon } from 'lucide-react';
import { ChartBarIcon, ChartPieIcon, SettingsIcon, UsersIcon } from 'lucide-react';

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
        Icon: ChartPieIcon,
    },
    {
        labelKey: 'nav.activity',
        href: ROUTES.ACTIVITY,
        Icon: ChartBarIcon,
    },
    {
        labelKey: 'nav.friends',
        href: ROUTES.FRIENDS,
        Icon: UsersIcon,
    },
    {
        labelKey: 'nav.settings',
        href: ROUTES.SETTINGS,
        Icon: SettingsIcon,
    },
];

export { getNavElements, type NavElement };
