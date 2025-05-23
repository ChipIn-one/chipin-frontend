import '@radix-ui/themes/styles.css';

import { Theme } from '@radix-ui/themes';
import { ThemeProvider } from 'next-themes';
import { AppRouter } from 'pages/AppRouter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider attribute="class">
            <Theme accentColor="grass" grayColor="gray" radius="large">
                <AppRouter />
            </Theme>
        </ThemeProvider>
    </StrictMode>,
);
