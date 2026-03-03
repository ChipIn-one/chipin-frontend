/* eslint-disable simple-import-sort/imports */
import Main from 'main';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import 'i18n';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

import 'i18n';
import 'constants/globals';

Sentry.init({
    dsn: 'https://9c23eacd86e99a489e72c35877a1f6e6@o4510982101794816.ingest.de.sentry.io/4510982104154192',
    environment: import.meta.env.VITE_VERCEL_ENV, // preview / production
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA, // git sha
});

createRoot(document.getElementById('root')!).render(
    <Sentry.ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThemeProvider attribute="class" enableSystem>
            <Analytics />
            <SpeedInsights />
            <Main />
        </ThemeProvider>
    </Sentry.ErrorBoundary>,
);
