import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

import { cleanupServiceWorkerUpdates, initServiceWorkerUpdates } from 'helpers/swUpdates';

// TODO: move it out of basics and rename to something like ServiceWorkerManager or similar, as it also handles SW updates and not only registration
const PWABadge = () => {
    useEffect(() => {
        registerSW({
            // Intentional no-op: update detection, TTL, and user-controlled
            // activation are fully handled by initServiceWorkerUpdates.
            onNeedRefresh() {},
        });

        // Wire up the update notification system:
        // waiting-worker check, updatefound listener, visibilitychange
        // re-notification, and hourly periodic poll.
        initServiceWorkerUpdates();

        return () => {
            cleanupServiceWorkerUpdates();
        };
    }, []);

    return null;
};

export default PWABadge;
