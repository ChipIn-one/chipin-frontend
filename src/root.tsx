import Main from 'main';
import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';

import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { LS_KEY_THEME } from 'constants/localstorage';
import { resolveStoredTheme } from 'helpers/theme';
import { useAuthStore } from 'store/authStore';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

import 'i18n';

Sentry.init({
    dsn: 'https://9c23eacd86e99a489e72c35877a1f6e6@o4510982101794816.ingest.de.sentry.io/4510982104154192',
    environment: import.meta.env.VITE_VERCEL_ENV, // preview / production
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA, // git sha
});

initChipInApiInterceptors(() => {
    useAuthStore.getState().expireSession();
});

createRoot(document.getElementById('root')!).render(
    <Sentry.ErrorBoundary fallback={<></>}>
        <ThemeProvider
            attribute="class"
            defaultTheme={resolveStoredTheme()}
            storageKey={LS_KEY_THEME}
            enableSystem
        >
            <Analytics />
            <SpeedInsights />
            <Main />
        </ThemeProvider>
    </Sentry.ErrorBoundary>,
);
