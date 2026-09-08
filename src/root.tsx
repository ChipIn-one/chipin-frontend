import Main from 'main';
import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';

import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { LS_KEY_THEME } from 'constants/localstorage';
import { APP_VERSION } from 'constants/version';
import { sanitizeTelemetryUrl } from 'helpers/telemetry';
import { resolveStoredTheme } from 'helpers/theme';
import { useAuthStore } from 'store/authStore';

import { GlobalErrorBoundary } from 'components/global-error-boundary';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

import 'i18n';

const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT;

Sentry.init({
    dsn: 'https://9c23eacd86e99a489e72c35877a1f6e6@o4510982101794816.ingest.de.sentry.io/4510982104154192',
    enabled: import.meta.env.VITE_SENTRY_ENABLED,
    environment: sentryEnvironment,
    release: APP_VERSION,
    sampleRate: 1,
    sendDefaultPii: false,
    beforeBreadcrumb: breadcrumb => {
        if (breadcrumb.category === 'console') {
            return null;
        }

        if (!breadcrumb.data) {
            return breadcrumb;
        }

        const data = { ...breadcrumb.data };

        for (const key of ['url', 'from', 'to']) {
            const value = data[key];

            if (typeof value === 'string') {
                data[key] = sanitizeTelemetryUrl(value);
            }
        }

        return {
            ...breadcrumb,
            data,
        };
    },
    beforeSend: event => {
        const request = event.request
            ? {
                  method: event.request.method,
                  url:
                      typeof event.request.url === 'string'
                          ? sanitizeTelemetryUrl(event.request.url)
                          : undefined,
              }
            : undefined;
        const extra = event.extra ? { ...event.extra } : undefined;

        if (extra) {
            delete extra.__serialized__;
        }

        return {
            ...event,
            extra,
            request,
            transaction:
                typeof event.transaction === 'string'
                    ? sanitizeTelemetryUrl(event.transaction)
                    : event.transaction,
            user: undefined,
        };
    },
});

initChipInApiInterceptors(() => {
    useAuthStore.getState().expireSession();
});

createRoot(document.getElementById('root')!).render(
    <GlobalErrorBoundary>
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
    </GlobalErrorBoundary>,
);
