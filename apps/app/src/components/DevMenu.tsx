import { useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, IconButton } from '@radix-ui/themes';
import { BugIcon, CalendarPlusIcon, FlaskConicalIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useExtendSubscriptionByDay, useUpdateSelf } from 'hooks/useUserMutations';
import { AUTH_STATUS } from 'store/authConstants';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectResolvedAppearance, selectSetPreference, useAppearanceStore } from 'store/ui-prefs';

import { Dropdown } from 'basics/Dropdown';

import styles from './DevMenu.module.css';

interface Props {
    isShowLabel?: boolean;
}

const DevMenu = ({ isShowLabel = false }: Props) => {
    const [shouldCrash, setShouldCrash] = useState(false);
    const resolved = useAppearanceStore(selectResolvedAppearance);
    const setPreference = useAppearanceStore(selectSetPreference);
    const { t } = useTranslation();
    const authStatus = useAuthStore(selectAuthStatus);
    const { updateSelf } = useUpdateSelf();
    const extendSubscriptionByDay = useExtendSubscriptionByDay();

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    const isDark = resolved === 'dark';
    const onSwitchTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';

        if (authStatus !== AUTH_STATUS.AUTHENTICATED) {
            setPreference(nextTheme);
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
        <Button
            className={styles.labeledTrigger}
            size="3"
            variant="outline"
            color={PROP_COLOR.neutral}
        >
            <FlaskConicalIcon />
            {t('header.devMenu')}
        </Button>
    ) : (
        <IconButton
            size={{
                initial: '2',
                sm: '3',
            }}
            variant="soft"
            color={PROP_COLOR.neutral}
            aria-label={t('header.devMenu')}
        >
            <FlaskConicalIcon />
        </IconButton>
    );

    return <Dropdown items={items} trigger={trigger} align="end" />;
};

export { DevMenu };
