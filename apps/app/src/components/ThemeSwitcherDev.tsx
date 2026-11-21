import { IconButton } from '@radix-ui/themes';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { selectResolvedAppearance, selectSetPreference, useAppearanceStore } from 'store/ui-prefs';

const ThemeSwitcherDev = () => {
    const resolved = useAppearanceStore(selectResolvedAppearance);
    const setPreference = useAppearanceStore(selectSetPreference);
    const { t } = useTranslation();
    const isDark = resolved === 'dark';

    const icon = isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />;
    const themeSwitchLabel = isDark
        ? t('header.switchToLightTheme')
        : t('header.switchToDarkTheme');

    return (
        <IconButton
            size={{
                initial: '2',
                sm: '3',
            }}
            variant="surface"
            aria-label={themeSwitchLabel}
            onClick={() => setPreference(isDark ? 'light' : 'dark')}
        >
            {icon}
        </IconButton>
    );
};

export { ThemeSwitcherDev };
