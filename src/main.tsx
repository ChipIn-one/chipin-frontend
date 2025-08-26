import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { Theme } from '@radix-ui/themes';

import PWABadge from 'basics/PWABadge';
import AppRouter from 'features/AppRouter';
import GlobalHooks from 'pages/GlobalHooks';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

createRoot(document.getElementById('root')!).render(
    <ThemeProvider attribute="class">
        <Theme
            accentColor="grass"
            grayColor="gray"
            radius="large"
            panelBackground="translucent"
            hasBackground
        >
            <BrowserRouter>
                <GlobalHooks />
                <AppRouter />
                <PWABadge />
                <Toaster theme="system" richColors closeButton />
            </BrowserRouter>
        </Theme>
    </ThemeProvider>,
);
