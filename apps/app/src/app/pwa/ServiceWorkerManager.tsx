// Spec 04 §2.11 (04-2d): the single service worker registration. `useRegisterSW` registers
// `/sw.js` with scope `/` (VitePWA `buildBase` + `filename` and the scope of `pwa.config.ts`),
// exactly what the former manual `register('/sw.js', { scope: '/' })` did, so the SW behaviour does not
// change (C2-01). There is no other registration call and no other place that sets a scope.
// Mounted once per page, above the per-user router (`root.tsx`); the app shell reports its route
// changes and safe points (`ServiceWorkerSafePoints`).
import { useEffect, useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { TOASTS_IDS } from 'constants/toasts';
import { reloadApp, setServiceWorkerControls, updateServiceWorker } from 'helpers/appUpdate';
import { isNetworkUsable } from 'shared/offline/network';
import { usePwaStore } from 'store/pwaStore';

import { isAtSafePoint, onRouteChange, reloadAtSafePoint } from './safePoint';
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
                        <Button
                            variant="ghost"
                            color={PROP_COLOR.neutral}
                            size="1"
                            onClick={onLater}
                        >
                            {t('update.later')}
                        </Button>
                        <Button
                            variant="soft"
                            color={PROP_COLOR.accent}
                            size="1"
                            onClick={onUpdate}
                        >
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
                    // The close button counts as "Later". Sonner also calls this after the controller
                    // dismissed the toast itself ("Update", "Later"): `later` is then a no-op.
                    onDismiss: controller.later,
                },
            );
        },
        hidePrompt: () => {
            toast.dismiss(TOASTS_IDS.swUpdate);
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
    useRegisterSW({
        onRegisteredSW: (_swUrl, registration) => {
            setRegistration(registration);
            controller.onRegistered(registration);
        },
        onNeedRefresh: () => {
            controller.onWaiting();
        },
        // The new worker took control. Another tab's update reloads this tab at its next safe point
        // (at most 30 s later). This tab's own update ("Update", a forced update, the error fallback)
        // still reloads at once: the `controllerchange` listener of `updateServiceWorker` does it,
        // whichever of the two runs first (a second reload is a no-op).
        onNeedReload: () => {
            reloadAtSafePoint(reloadApp);
        },
        // No service worker (an insecure origin, a blocked or unsupported browser): the app runs
        // without one, as before; there is nothing to recover.
        onRegisterError: () => undefined,
    });

    // The controls outlive this component on purpose: the global error fallback still reads the
    // registration through them. Updates are applied by `helpers/appUpdate` (`SKIP_WAITING` to the
    // waiting worker), not by the hook's `updateServiceWorker`: before the window `load`
    // workbox-window has no registration and its skip-waiting message would be lost.
    useEffect(() => {
        setServiceWorkerControls({ getRegistration });
    }, [getRegistration]);

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
    // `useRegisterSW` registers in its state initializer, during render. A render React throws away
    // (it renders the whole root again after an error in a sibling, e.g. an app that crashes on its
    // first render) would register a second time, so the registering child mounts only after this
    // component has committed (a task later, so the commit itself is never re-rendered).
    const [isCommitted, setIsCommitted] = useState(false);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setIsCommitted(true);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, []);

    if (!isCommitted) {
        return null;
    }

    return <ServiceWorkerRegistration />;
};
