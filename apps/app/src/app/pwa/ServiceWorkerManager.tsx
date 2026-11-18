// Spec 04 §2.11 (04-2d): the single service worker registration. `useRegisterSW` registers
// `/sw.js` with scope `/` (VitePWA `buildBase` + `filename` and the scope of `pwa.config.ts`),
// exactly what the former manual `register('/sw.js', { scope: '/' })` did, so the SW behaviour does not
// change (C2-01). There is no other registration call and no other place that sets a scope.
// Mounted once per page, above the per-user router (`root.tsx`, both the app and the prerendered
// public branch); the app shell reports its route changes and safe points (`ServiceWorkerSafePoints`).
import { useEffect, useState } from 'react';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { TOASTS_IDS } from 'constants/toasts';
import { reloadApp, setServiceWorkerControls, updateServiceWorker } from 'helpers/appUpdate';
import { shouldRegisterServiceWorker } from 'helpers/serviceWorkerHost';
import { isNetworkUsable } from 'shared/offline/network';
import { usePwaStore } from 'store/pwaStore';

import { isAtSafePoint, onRouteChange } from './safePoint';
import { createUpdateController, type UpdateController } from './updateController';
import { UPDATE_CHECK_INTERVAL_MS } from './updatePolicy';

// Re-exported so the app layer reads the whole SW API from here (the lower layers import it from
// `helpers/appUpdate`, which they may import).
export { onBeforeAppReload, updateServiceWorker } from 'helpers/appUpdate';

interface UpdateAvailableToastProps {
    onUpdate: () => void;
    onLater: () => void;
}

const UpdateAvailableToast = ({ onUpdate, onLater }: UpdateAvailableToastProps) => {
    const { t } = useTranslation('pwa');

    return (
        <Box minWidth="356px">
            <Card size="1">
                <Flex align="center" gap="2" justify="between">
                    <Text size="1" weight="bold">
                        {t('update.available')}
                    </Text>
                    <Flex gap="4" align="center">
                        <Button variant="ghost" color="gray" size="1" onClick={onLater}>
                            {t('update.later')}
                        </Button>
                        <Button variant="soft" color="jade" size="1" onClick={onUpdate}>
                            <RefreshCwIcon size={14} aria-hidden="true" />
                            {t('update.action')}
                        </Button>
                    </Flex>
                </Flex>
            </Card>
        </Box>
    );
};

interface ServiceWorkerSession {
    controller: UpdateController;
    getRegistration: () => ServiceWorkerRegistration | undefined;
    setRegistration: (registration: ServiceWorkerRegistration | undefined) => void;
}

const createSession = (): ServiceWorkerSession => {
    let registration: ServiceWorkerRegistration | undefined;
    const getRegistration = (): ServiceWorkerRegistration | undefined => registration;
    // Set when the controller hides the toast itself, so its `onDismiss` is not taken for "Later".
    let isHidingPrompt = false;
    const controller: UpdateController = createUpdateController({
        getRegistration,
        applyUpdate: () => {
            void updateServiceWorker(true);
        },
        isSafePoint: isAtSafePoint,
        isOnline: isNetworkUsable,
        showPrompt: () => {
            toast.custom(
                () => (
                    <UpdateAvailableToast onUpdate={controller.update} onLater={controller.later} />
                ),
                {
                    id: TOASTS_IDS.swUpdate,
                    duration: Infinity,
                    // The close button counts as "Later".
                    onDismiss: () => {
                        if (!isHidingPrompt) {
                            controller.later();
                        }
                    },
                },
            );
        },
        hidePrompt: () => {
            isHidingPrompt = true;
            toast.dismiss(TOASTS_IDS.swUpdate);
            isHidingPrompt = false;
        },
        setUpdateAvailable: isAvailable => {
            usePwaStore.getState().setIsSwUpdateAvailable(isAvailable);
        },
        now: Date.now,
    });

    return {
        controller,
        getRegistration,
        setRegistration: next => {
            registration = next;
        },
    };
};

const ServiceWorkerRegistration = () => {
    const [{ controller, getRegistration, setRegistration }] = useState(createSession);
    const { updateServiceWorker: applyWaitingWorker } = useRegisterSW({
        onRegisteredSW: (_swUrl, registration) => {
            setRegistration(registration);
            controller.onRegistered(registration);
        },
        onNeedRefresh: () => {
            controller.onWaiting();
        },
        // The new worker took control (this tab's update, or another tab's): reload through the
        // `onBeforeAppReload` callbacks.
        onNeedReload: reloadApp,
        // No service worker (an insecure origin, a blocked or unsupported browser): the app runs
        // without one, as before; there is nothing to recover.
        onRegisterError: () => undefined,
    });

    // The controls outlive this component on purpose: the global error fallback that replaces the
    // tree still applies an update through them.
    useEffect(() => {
        setServiceWorkerControls({ update: applyWaitingWorker, getRegistration });
    }, [applyWaitingWorker, getRegistration]);

    useEffect(() => {
        const onVisibilityChange = (): void => {
            if (document.visibilityState === 'visible') {
                controller.onVisible();
            }
        };
        const intervalId = window.setInterval(controller.onHourlyCheck, UPDATE_CHECK_INTERVAL_MS);
        const stopRouteChanges = onRouteChange(controller.onRouteChange);

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearInterval(intervalId);
            stopRouteChanges();
        };
    }, [controller]);

    return null;
};

/** The single service worker registration and its update policy (spec 04 §2.11 items 1–3). */
export const ServiceWorkerManager = () => {
    // The legacy hosts serve the kill-switch at /sw.js: register nothing there (04-4a1).
    if (!shouldRegisterServiceWorker(window.location.hostname)) {
        return null;
    }

    return <ServiceWorkerRegistration />;
};
