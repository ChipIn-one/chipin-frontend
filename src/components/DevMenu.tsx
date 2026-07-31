import { useState } from 'react';
import {
    LucideBug,
    LucideCalendarPlus,
    LucideFlaskConical,
    LucideMoon,
    LucideSun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@radix-ui/themes';

import { isThemeDark } from 'helpers/theme';
import { useUsersStore } from 'store/users-store';

import Dropdown from './Dropdown';

const DevMenu = () => {
    const [shouldCrash, setShouldCrash] = useState(false);
    const { resolvedTheme } = useTheme();
    const { t } = useTranslation();
    const extendUserSubscriptionByDay = useUsersStore(s => s.extendUserSubscriptionByDay);
    const setUserSettings = useUsersStore(s => s.setUserSettings);

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    const isDark = isThemeDark(resolvedTheme);
    const onSwitchTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';

        void setUserSettings({ settings: { theme: nextTheme } }).catch(() => undefined);
    };

    const items = [
        {
            value: 'switchTheme',
            label: t('header.switchTheme'),
            icon: isDark ? <LucideSun size={16} /> : <LucideMoon size={16} />,
            onSelect: onSwitchTheme,
        },
        {
            value: 'extendSubscription',
            label: t('header.addSubscriptionDay'),
            icon: <LucideCalendarPlus size={16} />,
            onSelect: extendUserSubscriptionByDay,
        },
        {
            value: 'testError',
            label: t('header.testError'),
            icon: <LucideBug size={16} />,
            onSelect: () => setShouldCrash(true),
        },
    ];

    return (
        <Dropdown
            items={items}
            trigger={
                <IconButton
                    size={{
                        initial: '2',
                        sm: '3',
                    }}
                    variant="soft"
                    color="gray"
                    aria-label={t('header.devMenu')}
                >
                    <LucideFlaskConical />
                </IconButton>
            }
            align="end"
        />
    );
};

export default DevMenu;
