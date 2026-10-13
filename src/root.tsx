import { ThemeProvider } from 'next-themes';
import { createRoot, hydrateRoot } from 'react-dom/client';

import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { initializeApi } from 'bootstrap/initializeApi';
import { initializeSentry } from 'bootstrap/initializeSentry';
import { LS_KEY_THEME } from 'constants/localstorage';
import { getPublicRoute } from 'helpers/publicRoutes';
import { sanitizeTelemetryEvent } from 'helpers/telemetry';
import { resolveStoredTheme } from 'helpers/theme';

import PWABadge from 'basics/PWABadge';
import { GlobalErrorBoundary } from 'components/global-error-boundary';
import { PublicBuildYearContext } from 'public-routes/PublicBuildYearContext';
import { PublicTelemetry } from 'public-routes/PublicTelemetry';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

import i18n from 'i18n';

initializeSentry();
initializeApi();

const rootElement = document.getElementById('root')!;
const publicBuildYear = Number(rootElement.dataset.publicBuildYear);
const prerenderedRoute = rootElement.dataset.publicSsg === 'true'
    ? getPublicRoute(window.location.pathname)
    : null;

if (prerenderedRoute) {
    // Hydration preserves static, indexable React markup from the build.
    import('public-routes')
        .then(({ PublicApp }) => i18n.changeLanguage(prerenderedRoute.locale)
            .then(() => hydrateRoot(
                rootElement,
                <GlobalErrorBoundary>
                    <PublicBuildYearContext.Provider
                        value={Number.isInteger(publicBuildYear) && publicBuildYear > 2000 ? publicBuildYear : null}
                    >
                        <PublicApp route={prerenderedRoute} i18nInstance={i18n} />
                    </PublicBuildYearContext.Provider>
                    <PublicTelemetry />
                    {/* Public SSG entry must register the same service worker as the SPA. */}
                    <PWABadge />
                </GlobalErrorBoundary>,
            )))
        .catch(error => Sentry.captureException(error));
} else {
    import('main')
        .then(({ default: Main }) => {
            createRoot(rootElement).render(
                <GlobalErrorBoundary>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme={resolveStoredTheme()}
                        storageKey={LS_KEY_THEME}
                        enableSystem
                    >
                        <Analytics beforeSend={sanitizeTelemetryEvent} />
                        <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
                        <Main />
                    </ThemeProvider>
                </GlobalErrorBoundary>,
            );
        })
        .catch(error => Sentry.captureException(error));
}
