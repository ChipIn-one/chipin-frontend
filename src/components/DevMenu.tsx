import { useState } from 'react';
import { Button, IconButton } from '@radix-ui/themes';
import { BugIcon, CalendarPlusIcon, FlaskConicalIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { isThemeDark } from 'helpers/theme';
import { useExtendSubscriptionByDay, useUpdateSelf } from 'hooks/useUserMutations';
import { AUTH_STATUS } from 'store/authConstants';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

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
    const { updateSelf } = useUpdateSelf();
    const extendSubscriptionByDay = useExtendSubscriptionByDay();

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    const isDark = isThemeDark(resolvedTheme);
    const onSwitchTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';

        if (authStatus !== AUTH_STATUS.AUTHENTICATED) {
            setTheme(nextTheme);
            return;
        }

        void updateSelf({ settings: { theme: nextTheme } });
    };

    const items = [
        {
            value: 'switchTheme',
            label: t('header.switchTheme'),
            icon: isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />,
            onSelect: onSwitchTheme,
        },
        {
            value: 'extendSubscription',
            label: t('header.addSubscriptionDay'),
            icon: <CalendarPlusIcon size={16} />,
            onSelect: extendSubscriptionByDay,
        },
        {
            value: 'testError',
            label: t('header.testError'),
            icon: <BugIcon size={16} />,
            onSelect: () => setShouldCrash(true),
        },
    ];
    const trigger = isShowLabel ? (
        <LabeledTrigger size="3" variant="outline" color="gray">
            <FlaskConicalIcon />
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
            <FlaskConicalIcon />
        </IconButton>
    );

    return <Dropdown items={items} trigger={trigger} align="end" />;
};

export default DevMenu;
