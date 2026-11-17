import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ThemeProvider } from 'next-themes';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { persistedUserId } from 'app/providers/persistedUserId';
import { initializeApi } from 'bootstrap/initializeApi';
import { initializeSentry } from 'bootstrap/initializeSentry';
import { LS_KEY_THEME } from 'constants/localstorage';
import { getLegacyHostAppUrl } from 'helpers/legacyHost';
import { getLocalUser } from 'helpers/localStorage';
import { getPublicRoute } from 'helpers/publicRoutes';
import { sanitizeTelemetryEvent } from 'helpers/telemetry';
import { resolveStoredTheme } from 'helpers/theme';
import i18n from 'i18n';
import { PublicBuildYearContext } from 'public-routes/PublicBuildYearContext';
import { PublicTelemetry } from 'public-routes/PublicTelemetry';

import PWABadge from 'basics/PWABadge';
import { GlobalErrorBoundary } from 'components/global-error-boundary';

import 'styles/index.css';

initializeSentry();
initializeApi();

const rootElement = document.getElementById('root')!;
const publicBuildYear = Number(rootElement.dataset.publicBuildYear);
const prerenderedRoute =
    rootElement.dataset.publicSsg === 'true' ? getPublicRoute(window.location.pathname) : null;
// Spec 04 §4.1, §4.5 step 1 (04-4a2): the full app never boots on a legacy host. Its session check
// would refresh there and rotate the old host-only cookie; `vercel.json` already redirects the
// private paths and `/index.html`-style URLs, this covers any other way to reach the SPA shell.
const legacyHostAppUrl = prerenderedRoute ? null : getLegacyHostAppUrl(window.location);

if (legacyHostAppUrl) {
    window.location.replace(legacyHostAppUrl);
} else if (prerenderedRoute) {
    // Hydration preserves static, indexable React markup from the build.
    import('public-routes')
        .then(({ PublicApp }) =>
            i18n.changeLanguage(prerenderedRoute.locale).then(() =>
                hydrateRoot(
                    rootElement,
                    <GlobalErrorBoundary>
                        <PublicBuildYearContext.Provider
                            value={
                                Number.isInteger(publicBuildYear) && publicBuildYear > 2000
                                    ? publicBuildYear
                                    : null
                            }
                        >
                            <PublicApp route={prerenderedRoute} i18nInstance={i18n} />
                        </PublicBuildYearContext.Provider>
                        <PublicTelemetry />
                        {/* Public SSG entry must register the same service worker as the SPA. */}
                        <PWABadge />
                    </GlobalErrorBoundary>,
                ),
            ),
        )
        .catch(error => Sentry.captureException(error));
} else {
    // The user's query cache is restored from IndexedDB before the app (and its router) renders;
    // the public SSG branch above never touches IndexedDB.
    Promise.all([import('main'), import('shared/offline/restore')])
        .then(([{ default: Main }, { startCacheRestore }]) => {
            startCacheRestore(persistedUserId(getLocalUser()?.id));
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
