import { useEffect } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

import { HOUR } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { APP_VERSION } from 'constants/version';

const PWA_UPDATED_KEY = 'pwa-just-updated';

const PWABadge = () => {
    // After auto-reload: show "updated to vX" toast if flag was set
    useEffect(() => {
        const updatedVersion = localStorage.getItem(PWA_UPDATED_KEY);
        if (updatedVersion) {
            localStorage.removeItem(PWA_UPDATED_KEY);
            toast.success(i18n.t('toasts:pwa.updated', { version: updatedVersion }), {
                id: TOASTS_IDS.pwaUpdated,
                duration: 5000,
            });
        }
    }, []);

    // Register SW once — auto-update silently on new version
    useEffect(() => {
        let updateSWFn: ((reloadPage?: boolean) => void) | undefined;

        updateSWFn = registerSW({
            onOfflineReady() {
                toast.success(i18n.t('toasts:pwa.offlineReady'), { duration: 3000 });
            },

            onNeedRefresh() {
                // Flag the version before reload so the toast shows after
                localStorage.setItem(PWA_UPDATED_KEY, APP_VERSION);
                updateSWFn?.(true);
            },

            onRegisteredSW(swUrl, r) {
                if (HOUR > 0 && r) {
                    registerPeriodicSync(HOUR, swUrl, r);
                }

                // Also check for updates whenever the user returns to the tab
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && navigator.onLine) {
                        r.update();
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
