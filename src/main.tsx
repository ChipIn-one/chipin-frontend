import { useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { Theme } from '@radix-ui/themes';

import BackgroundBox from 'basics/BackgroundBox';
import PWABadge from 'basics/PWABadge';
import AppRouter from 'features/AppRouter';
import GlobalHooks from 'pages/GlobalHooks';

const Main = () => {
    const { resolvedTheme } = useTheme();

    const themeName = (resolvedTheme as 'light' | 'dark') || 'system';

    return (
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
                    <GlobalHooks />
                    <AppRouter />
                    <PWABadge />
                    <Toaster theme={themeName} richColors closeButton />
                </BackgroundBox>
            </BrowserRouter>
        </Theme>
    );
};

export default Main;
