import { LucideMoon, LucideSun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@radix-ui/themes';

import { isThemeDark } from 'helpers/theme';

const ThemeSwitcherDev = () => {
    const { resolvedTheme, setTheme } = useTheme();
    const { t } = useTranslation();
    const isDark = isThemeDark(resolvedTheme);

    const icon = isDark ? <LucideSun size={20} /> : <LucideMoon size={20} />;
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
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
            {icon}
        </IconButton>
    );
};

export default ThemeSwitcherDev;
