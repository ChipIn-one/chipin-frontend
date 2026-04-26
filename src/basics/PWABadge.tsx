import { useEffect } from 'react';
import i18n from 'i18n';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

import { HOUR } from 'constants/time';

const PWABadge = () => {
    // Register SW once — auto-update silently on new version
    useEffect(() => {
        const ref: { update?: (reloadPage?: boolean) => void } = {};

        ref.update = registerSW({
            onOfflineReady() {
                toast.success(i18n.t('toasts:pwa.offlineReady'), { duration: 3000 });
            },

            onNeedRefresh() {
                ref.update?.(true);
            },

            onRegisteredSW(swUrl, registration) {
                if (HOUR > 0 && registration) {
                    registerPeriodicSync(HOUR, swUrl, registration);
                }

                // Also check for updates whenever the user returns to the tab
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && navigator.onLine) {
                        registration?.update();
                    }
                });
            },
        });
    }, []);

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
