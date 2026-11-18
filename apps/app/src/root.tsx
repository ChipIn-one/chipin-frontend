import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ThemeProvider } from 'next-themes';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { persistedUserId } from 'app/providers/persistedUserId';
import { ServiceWorkerManager } from 'app/pwa/ServiceWorkerManager';
import { initializeApi } from 'bootstrap/initializeApi';
import { initializeSentry } from 'bootstrap/initializeSentry';
import { LS_KEY_THEME } from 'constants/localstorage';
import { getLegacyHostAppUrl, removeLegacyHostWebAppHeadTags } from 'helpers/legacyHost';
import { getLocalUser } from 'helpers/localStorage';
import { getPublicRoute } from 'helpers/publicRoutes';
import { checkIsPwaInstalled } from 'helpers/pwa';
import { applyLanguage } from 'helpers/setAppLanguage';
import { sanitizeTelemetryEvent } from 'helpers/telemetry';
import { resolveStoredTheme } from 'helpers/theme';
import { i18n, i18nReady } from 'i18n';
import { syncHtmlLang } from 'i18n/htmlLang';
import { PublicBuildYearContext } from 'public-routes/PublicBuildYearContext';
import { PublicTelemetry } from 'public-routes/PublicTelemetry';

import { GlobalErrorBoundary } from 'components/global-error-boundary';

import 'styles/index.css';

// #758: first thing on a legacy host, drop the manifest link and the web-app metas of the shared
// HTML, so the landing there is never installed as the app (no-op on every other host).
removeLegacyHostWebAppHeadTags(document, window.location.hostname);
initializeSentry();
initializeApi();
// #708: `<html lang>` follows the UI language from the first frame on.
syncHtmlLang(i18n);

// Spec 04 §2.10: the first render waits for the initial language's lazy chunks. i18next settles
// its init even when a chunk fails (offline first visit, a 404 after a deploy: the missing
// namespaces fall back to `en` or keys); should it ever reject, the page still renders.
const i18nSettled = i18nReady.catch((error: unknown) => {
    Sentry.captureException(error);
});

const rootElement = document.getElementById('root')!;
const publicBuildYear = Number(rootElement.dataset.publicBuildYear);
const prerenderedRoute =
    rootElement.dataset.publicSsg === 'true' ? getPublicRoute(window.location.pathname) : null;
// Spec 04 §4.1, §4.5 step 1 (04-4a2): the full app never boots on a legacy host. Its session check
// would refresh there and rotate the old host-only cookie; `vercel.json` already redirects the
// private paths and `/index.html`-style URLs, this covers any other way to reach the SPA shell.
const legacyHostAppUrl = prerenderedRoute ? null : getLegacyHostAppUrl(window.location);

if (legacyHostAppUrl) {
    // #758: in an icon installed from the legacy host (standalone) the app host would open in an
    // in-app sheet whose session never reaches the icon; the landing of the same host shows the
    // reinstall notice instead. At `/` itself (never the SPA shell in a real deploy) nothing boots,
    // so the page cannot loop.
    if (!checkIsPwaInstalled()) {
        window.location.replace(legacyHostAppUrl);
    } else if (window.location.pathname !== '/') {
        window.location.replace('/');
    }
} else if (prerenderedRoute) {
    // Hydration preserves static, indexable React markup from the build. The route language is
    // loaded first (spec 04 §2.10: lazy locale chunks), so hydration never renders raw keys.
    Promise.all([import('public-routes'), i18nSettled])
        .then(([{ PublicApp }]) =>
            // A route language that fails to load is reported; the page still hydrates (with the
            // `en` fallback strings), so the worker, telemetry and effects of the page run.
            applyLanguage(prerenderedRoute.locale)
                .catch((error: unknown) => {
                    Sentry.captureException(error);
                })
                .then(() =>
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
                            <ServiceWorkerManager />
                        </GlobalErrorBoundary>,
                    ),
                ),
        )
        .catch(error => Sentry.captureException(error));
} else {
    // The user's query cache is restored from IndexedDB before the app (and its router) renders;
    // the public SSG branch above never touches IndexedDB. The first render waits for the initial
    // language's lazy chunks (spec 04 §2.10), so it never shows raw keys.
    Promise.all([
        import('main'),
        import('shared/offline/restore'),
        import('app/pwa/expenseDraftReload'),
    ])
        .then(([{ default: Main }, { startCacheRestore }, { startExpenseDraftReload }]) => {
            startCacheRestore(persistedUserId(getLocalUser()?.id));
            // Spec 04 §2.11 item 4: an expense draft saved before an app reload reopens once.
            startExpenseDraftReload();
            return i18nSettled.then(() => Main);
        })
        .then(Main => {
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
                        {/* The single SW registration, once per page (above the per-user router). */}
                        <ServiceWorkerManager />
                    </ThemeProvider>
                </GlobalErrorBoundary>,
            );
        })
        .catch(error => Sentry.captureException(error));
}
