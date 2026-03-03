import { LucideMoon, LucideSun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { IconButton } from '@radix-ui/themes';

const ThemeSwitcherDev = () => {
    const { theme, setTheme } = useTheme();

    const icon = theme === 'light' ? <LucideMoon size={20} /> : <LucideSun size={20} />;

    return (
        <IconButton
            size={{
                initial: '2',
                sm: '3',
            }}
            variant="surface"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
            {icon}
        </IconButton>
    );
};

export default ThemeSwitcherDev;
