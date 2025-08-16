import { StrictMode } from 'react';
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
    <StrictMode>
        <ThemeProvider attribute="class">
            <Theme accentColor="grass" grayColor="gray" radius="large">
                <BrowserRouter>
                    <GlobalHooks />
                    <AppRouter />
                    <PWABadge />
                    <Toaster richColors closeButton />
                </BrowserRouter>
            </Theme>
        </ThemeProvider>
    </StrictMode>,
);
