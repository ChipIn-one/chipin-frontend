import { useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'styled-components';

import { Box, Theme } from '@radix-ui/themes';

import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import { useIsMobile } from 'hooks/common';

import BackgroundBox from 'basics/BackgroundBox';
import PWABadge from 'basics/PWABadge';
import AddExpenseButton from 'components/AddExpenseButton';
import GlobalErrorBoundary from 'components/GlobalErrorBoundary';
import Header from 'components/Header';
import AppRouter from 'features/AppRouter';
import GlobalHooks from 'pages/GlobalHooks';

const Main = () => {
    const { resolvedTheme } = useTheme();
    const themeName = (resolvedTheme as 'light' | 'dark') || 'system';
    const styledThemeParams = themeName === 'dark' ? darkThemeStyled : lightThemeStyled;
    const isMobile = useIsMobile();

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
                <GlobalErrorBoundary>
                    <BrowserRouter>
                        <BackgroundBox>
                            <Header />
                            <GlobalHooks />
                            <Box px="4">
                                <AppRouter />
                            </Box>
                            <AddExpenseButton />
                            <PWABadge />

                            <Toaster
                                theme={themeName}
                                richColors
                                closeButton
                                position={isMobile ? 'top-center' : 'bottom-left'}
                                offset={isMobile ? 12 : 16}
                                mobileOffset={isMobile ? 12 : 16}
                            />
                        </BackgroundBox>
                    </BrowserRouter>
                </GlobalErrorBoundary>
            </Theme>
        </ThemeProvider>
    );
};

export default Main;
