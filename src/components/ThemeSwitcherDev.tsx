import { LucideMoon, LucideSun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { IconButton } from '@radix-ui/themes';

import { isThemeDark } from 'helpers/theme';

const ThemeSwitcherDev = () => {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = isThemeDark(resolvedTheme);

    const icon = isDark ? <LucideSun size={20} /> : <LucideMoon size={20} />;

    return (
        <IconButton
            size={{
                initial: '2',
                sm: '3',
            }}
            variant="surface"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
            {icon}
        </IconButton>
    );
};

export default ThemeSwitcherDev;
