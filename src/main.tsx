import { StrictMode } from 'react';
import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { Theme } from '@radix-ui/themes';

import PWABadge from 'basics/PWABadge';
import { AppRouter } from 'pages/AppRouter';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider attribute="class">
            <Theme accentColor="grass" grayColor="gray" radius="large">
                <AppRouter />
                <PWABadge />
                <Toaster />
            </Theme>
        </ThemeProvider>
    </StrictMode>,
);
