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
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Button, IconButton } from '@radix-ui/themes';

import { isThemeDark } from 'helpers/theme';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

import Dropdown from './Dropdown';

interface Props {
    isShowLabel?: boolean;
}

const LabeledTrigger = styled(Button)`
    width: 100%;
    justify-content: flex-start;
`;

const DevMenu = ({ isShowLabel = false }: Props) => {
    const [shouldCrash, setShouldCrash] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();
    const { t } = useTranslation();
    const authStatus = useAuthStore(selectAuthStatus);
    const { extendUserSubscriptionByDay, setUserSettings } = useUsersStore(
        useShallow(state => ({
            extendUserSubscriptionByDay: state.extendUserSubscriptionByDay,
            setUserSettings: state.setUserSettings,
        })),
    );

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    const isDark = isThemeDark(resolvedTheme);
    const onSwitchTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';

        if (authStatus !== 'authenticated') {
            setTheme(nextTheme);
            return;
        }

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
    const trigger = isShowLabel ? (
        <LabeledTrigger size="3" variant="outline" color="gray">
            <LucideFlaskConical />
            {t('header.devMenu')}
        </LabeledTrigger>
    ) : (
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
    );

    return (
        <Dropdown
            items={items}
            trigger={trigger}
            align="end"
        />
    );
};

export default DevMenu;
