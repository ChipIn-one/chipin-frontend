import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { createRoot } from 'react-dom/client';

import { persistedUserId } from 'app/providers/persistedUserId';
import { ServiceWorkerManager } from 'app/pwa/ServiceWorkerManager';
import { initializeApi } from 'bootstrap/initializeApi';
import { initializeSentry } from 'bootstrap/initializeSentry';
import { getLocalUser } from 'helpers/localStorage';
import { sanitizeTelemetryEvent } from 'helpers/telemetry';
import { i18n, i18nReady } from 'i18n';
import { syncHtmlLang } from 'i18n/htmlLang';

import { GlobalErrorBoundary } from 'components/global-error-boundary';

import 'styles/index.css';

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

// The SW manager sits outside the app's error boundary; its own boundary keeps a failure of the
// manager from blanking the page (renders nothing; the controls it handed over outlive it).
const IsolatedServiceWorkerManager = () => (
    <Sentry.ErrorBoundary
        beforeCapture={scope => {
            scope.setTag('errorBoundary', 'serviceWorkerManager');
        }}
        fallback={<></>}
    >
        <ServiceWorkerManager />
    </Sentry.ErrorBoundary>
);

const rootElement = document.getElementById('root')!;

// The user's query cache is restored from IndexedDB before the app (and its router) renders. The
// first render waits for the initial language's lazy chunks (spec 04 §2.10), so it never shows raw
// keys. Importing `main` runs `initAppearance()`, which applies the theme class to `<html>` before
// that render (spec 05 §2).
Promise.all([
    import('main'),
    import('shared/offline/restore'),
    import('app/pwa/expenseDraftReload'),
])
    .then(([{ Main }, { startCacheRestore }, { startExpenseDraftReload }]) => {
        startCacheRestore(persistedUserId(getLocalUser()?.id));
        // Spec 04 §2.11 item 4: an expense draft saved before an app reload reopens once.
        startExpenseDraftReload();
        return i18nSettled.then(() => Main);
    })
    .then(Main => {
        createRoot(rootElement).render(
            <>
                <GlobalErrorBoundary>
                    <Analytics beforeSend={sanitizeTelemetryEvent} />
                    <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
                    <Main />
                </GlobalErrorBoundary>
                {/* The single SW registration, once per page, outside the error boundary: it
                    keeps running for the error fallback when the app crashes on first render. */}
                <IsolatedServiceWorkerManager />
            </>,
        );
    })
    .catch(error => Sentry.captureException(error));
