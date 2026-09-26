import type { ReactNode } from 'react';

import * as Sentry from '@sentry/react';

import { APP_VERSION } from 'constants/version';

import { GlobalErrorFallback } from './GlobalErrorFallback';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

const GlobalErrorBoundary = ({ children }: GlobalErrorBoundaryProps) => (
    <Sentry.ErrorBoundary
        beforeCapture={(scope, _error, componentStack) => {
            scope.setTag('errorBoundary', 'global');
            scope.setExtras({
                appVersion: APP_VERSION,
                componentStack,
                timestamp: new Date().toISOString(),
            });
        }}
        fallback={() => (
            <GlobalErrorFallback timestamp={new Date().toISOString()} />
        )}
    >
        {children}
    </Sentry.ErrorBoundary>
);

export { GlobalErrorBoundary };
