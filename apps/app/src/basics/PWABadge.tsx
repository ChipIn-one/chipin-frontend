import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

import { shouldRegisterServiceWorker } from 'helpers/serviceWorkerHost';
import { cleanupServiceWorkerUpdates, initServiceWorkerUpdates } from 'helpers/swUpdates';

// TODO: move it out of basics and rename to something like ServiceWorkerManager or similar, as it also handles SW updates and not only registration
const PWABadge = () => {
    useEffect(() => {
        // The legacy hosts serve the kill-switch at /sw.js: register nothing there (04-4a1).
        if (!shouldRegisterServiceWorker(window.location.hostname)) {
            return;
        }

        registerSW({
            // Intentional no-op: update detection, TTL, and user-controlled
            // activation are fully handled by initServiceWorkerUpdates.
            onNeedRefresh() {},
        });

        // Wire up the update notification system:
        // waiting-worker check, updatefound listener, visibilitychange
        // re-notification, and hourly periodic poll.
        void initServiceWorkerUpdates();

        return () => {
            cleanupServiceWorkerUpdates();
        };
    }, []);

    return null;
};

export default PWABadge;
