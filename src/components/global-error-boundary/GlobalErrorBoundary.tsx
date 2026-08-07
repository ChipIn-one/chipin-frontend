import type { ReactNode } from 'react';

import * as Sentry from '@sentry/react';

import { APP_VERSION } from 'constants/version';

import { GlobalErrorFallback } from './GlobalErrorFallback';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

const normalizeError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

const GlobalErrorBoundary = ({ children }: GlobalErrorBoundaryProps) => (
    <Sentry.ErrorBoundary
        beforeCapture={(scope, _error, componentStack) => {
            scope.setTag('errorBoundary', 'global');
            scope.setExtras({
                appVersion: APP_VERSION,
                componentStack,
                route: window.location.pathname,
                timestamp: new Date().toISOString(),
            });
        }}
        fallback={({ error }) => (
            <GlobalErrorFallback
                error={normalizeError(error)}
                timestamp={new Date().toISOString()}
            />
        )}
    >
        {children}
    </Sentry.ErrorBoundary>
);

export { GlobalErrorBoundary };
