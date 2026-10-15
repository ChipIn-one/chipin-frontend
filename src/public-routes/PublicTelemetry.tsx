import { useSyncExternalStore } from 'react';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { sanitizeTelemetryEvent } from 'helpers/telemetry';

// Vercel telemetry is client-only. useSyncExternalStore returns false during
// hydration, matching the static SSG HTML, and true for subsequent client renders.
const subscribeToHydration = () => () => undefined;
const getClientHydration = () => true;
const getServerHydration = () => false;

const PublicTelemetry = () => {
    const isHydrated = useSyncExternalStore(
        subscribeToHydration,
        getClientHydration,
        getServerHydration,
    );

    if (!isHydrated) {
        return null;
    }

    return (
        <>
            <Analytics beforeSend={sanitizeTelemetryEvent} />
            <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
        </>
    );
};

export { PublicTelemetry };
