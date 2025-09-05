import { useState } from 'react';
import { useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'styled-components';

import { Theme } from '@radix-ui/themes';

import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';

import BackgroundBox from 'basics/BackgroundBox';
import PWABadge from 'basics/PWABadge';
import AppRouter from 'features/AppRouter';
import GlobalHooks from 'pages/GlobalHooks';

const Main = () => {
    const { resolvedTheme } = useTheme();
    const [them, setTheme] = useState(resolvedTheme as 'light' | 'dark');
    // const themeName = (resolvedTheme as 'light' | 'dark') || 'system';
    const styledThemeParams = them === 'dark' ? darkThemeStyled : lightThemeStyled;

    return (
        <ThemeProvider theme={styledThemeParams}>
            <button onClick={() => setTheme(them === 'light' ? 'dark' : 'light')}>
                Toggle Theme
            </button>
            <Theme
                appearance={them}
                accentColor="grass"
                grayColor="olive"
                radius="large"
                panelBackground="translucent"
                hasBackground
            >
                <BrowserRouter>
                    <BackgroundBox>
                        <GlobalHooks />
                        <AppRouter />
                        <PWABadge />
                        <Toaster theme={them} richColors closeButton />
                    </BackgroundBox>
                </BrowserRouter>
            </Theme>
        </ThemeProvider>
    );
};

export default Main;
