import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

import { HOUR } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';

const PWABadge = () => {
    const updateSWRef = useRef<((reloadPage?: boolean) => void) | null>(null);
    const [shown, setShown] = useState(false);

    const updateSW = registerSW({
        // Show a short toast when offline cache is ready (optional UX)
        onOfflineReady() {
            // toast.success('App is ready to work offline', { duration: 3000 });
        },

        // When a new version is available — show a persistent Sonner toast with an update button
        onNeedRefresh() {
            if (shown) {
                return;
            }
            setShown(true);

            toast.info('A new version is available', {
                id: TOASTS_IDS.pwaUpdateAvailable,
                duration: Infinity, // persist until user clicks
                action: {
                    label: 'Update',
                    onClick: () => updateSWRef.current?.(true), // update SW and reload the page
                },
            });
        },

        // Keep periodic SW update checks as before
        onRegisteredSW(swUrl, r) {
            if (HOUR > 0 && r) {
                registerPeriodicSync(HOUR, swUrl, r);
            }
        },
    });

    useEffect(() => {
        updateSWRef.current = updateSW;
    }, [shown, updateSW]);

    // Nothing to render — Sonner handles the UI
    return null;
};

export default PWABadge;

/**
 * Periodically checks for SW updates.
 */
const registerPeriodicSync = (period: number, swUrl: string, r: ServiceWorkerRegistration) => {
    if (period <= 0) {
        return;
    }

    setInterval(async () => {
        if ('onLine' in navigator && !navigator.onLine) {
            return;
        }

        const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { 'cache-control': 'no-cache' },
        });

        if (resp?.status === 200) {
            await r.update();
        }
    }, period);
};
