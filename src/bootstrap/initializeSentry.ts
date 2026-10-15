import * as Sentry from '@sentry/react';

import { APP_VERSION } from 'constants/version';
import { resolveTelemetryEnvironment, sanitizeTelemetryUrl } from 'helpers/telemetry';

const initializeSentry = () => {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim() || undefined;
    const sentryEnvironment = resolveTelemetryEnvironment(
        import.meta.env.VITE_SENTRY_ENVIRONMENT,
        window.location.hostname,
    );
    
    Sentry.init({
        dsn: sentryDsn,
        enabled: import.meta.env.VITE_SENTRY_ENABLED && sentryDsn !== undefined,
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
};

export { initializeSentry };
