import { useEffect } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

import { HOUR } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { APP_VERSION } from 'constants/version';

const PWA_LAST_VERSION_KEY = 'pwa-last-version';

const PWABadge = () => {
    // Show toast when APP_VERSION differs from the last stored version
    useEffect(() => {
        const lastVersion = localStorage.getItem(PWA_LAST_VERSION_KEY);

        if (lastVersion && lastVersion !== APP_VERSION) {
            toast.success(i18n.t('toasts:pwa.updated', { version: APP_VERSION }), {
                id: TOASTS_IDS.pwaUpdated,
                duration: 5000,
            });
        }

        localStorage.setItem(PWA_LAST_VERSION_KEY, APP_VERSION);
    }, []);

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
