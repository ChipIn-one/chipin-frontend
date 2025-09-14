import { useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'styled-components';

import { Box, Theme } from '@radix-ui/themes';

import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';

import BackgroundBox from 'basics/BackgroundBox';
import PWABadge from 'basics/PWABadge';
import Header from 'components/Header';
import AppRouter from 'features/AppRouter';
import GlobalHooks from 'pages/GlobalHooks';

const Main = () => {
    const { resolvedTheme } = useTheme();
    const themeName = (resolvedTheme as 'light' | 'dark') || 'system';
    const styledThemeParams = themeName === 'dark' ? darkThemeStyled : lightThemeStyled;

    return (
        <ThemeProvider theme={styledThemeParams}>
            <Theme
                appearance={themeName}
                accentColor="grass"
                grayColor="olive"
                radius="large"
                panelBackground="translucent"
                hasBackground
            >
                <BrowserRouter>
                    <BackgroundBox>
                        <Header />
                        <GlobalHooks />
                        <Box px="4">
                            <AppRouter />
                        </Box>
                        <PWABadge />
                        <Toaster theme={themeName} richColors closeButton />
                    </BackgroundBox>
                </BrowserRouter>
            </Theme>
        </ThemeProvider>
    );
};

export default Main;
