// Spec 04 §2.11 (04-2d): the app's reload and service-worker update entry points. The single
// registration lives in `app/pwa/ServiceWorkerManager.tsx`, which hands its `updateServiceWorker`
// and its registration to this module, so the lower layers (the error fallback, the settings page)
// apply an update without importing the `app` layer. Every reload path (an applied update, the
// "update required" button, the error fallback) goes through `reloadApp`, which first runs the
// `onBeforeAppReload` callbacks (04-2d registers the expense draft save there).
import * as Sentry from '@sentry/react';

import { SECOND } from 'constants/time';

type BeforeAppReloadCallback = () => void;
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

interface ServiceWorkerControls {
    update: UpdateServiceWorker;
    getRegistration: () => ServiceWorkerRegistration | undefined;
}

/** How long an activated update may take to take control before the page reloads anyway. */
export const UPDATE_ACTIVATION_TIMEOUT_MS = 10 * SECOND;

const beforeReloadCallbacks: BeforeAppReloadCallback[] = [];
let controls: ServiceWorkerControls | null = null;
let isReloading = false;

/**
 * Runs `callback` right before any app reload, in registration order. Returns the unsubscribe.
 * A callback must be synchronous: the page unloads right after the callbacks return.
 */
export const onBeforeAppReload = (callback: BeforeAppReloadCallback): (() => void) => {
    beforeReloadCallbacks.push(callback);

    return () => {
        const index = beforeReloadCallbacks.indexOf(callback);

        if (index !== -1) {
            beforeReloadCallbacks.splice(index, 1);
        }
    };
};

const runBeforeAppReload = (): void => {
    [...beforeReloadCallbacks].forEach(callback => {
        try {
            callback();
        } catch (error: unknown) {
            // One failed callback must not stop the others or the reload.
            Sentry.captureException(error);
        }
    });
};

/** Runs the `onBeforeAppReload` callbacks, then reloads the page; a second call does nothing. */
export const reloadApp = (): void => {
    if (isReloading) {
        return;
    }
    isReloading = true;
    runBeforeAppReload();
    window.location.reload();
};

/** Called by `ServiceWorkerManager` once it registered the worker (`null` on unmount). */
export const setServiceWorkerControls = (next: ServiceWorkerControls | null): void => {
    controls = next;
};

/** The registration of `/sw.js`, once `ServiceWorkerManager` has it. */
export const getServiceWorkerRegistration = (): ServiceWorkerRegistration | undefined =>
    controls?.getRegistration();

/**
 * Applies the waiting worker (`SKIP_WAITING`) and reloads once it takes control; with
 * `reloadPage` false only the worker is activated. Without a registered worker (no SW support,
 * a legacy host) it only reloads. If the new worker does not take control within
 * `UPDATE_ACTIVATION_TIMEOUT_MS`, the page reloads anyway, so the user is never stuck.
 */
export const updateServiceWorker = (reloadPage = true): Promise<void> => {
    if (!controls) {
        if (reloadPage) {
            reloadApp();
        }
        return Promise.resolve();
    }

    if (reloadPage) {
        const container =
            typeof navigator !== 'undefined' && 'serviceWorker' in navigator
                ? navigator.serviceWorker
                : undefined;
        const onControllerChange = (): void => {
            window.clearTimeout(timeoutId);
            reloadApp();
        };
        const timeoutId = window.setTimeout(() => {
            container?.removeEventListener('controllerchange', onControllerChange);
            reloadApp();
        }, UPDATE_ACTIVATION_TIMEOUT_MS);

        container?.addEventListener('controllerchange', onControllerChange, { once: true });
    }

    return controls.update(reloadPage).catch((error: unknown) => {
        Sentry.captureException(error);
        if (reloadPage) {
            reloadApp();
        }
    });
};

/**
 * Whether a newer worker is waiting: asks the server for `/sw.js` first (an offline or failed
 * check reads the current state). False without a registration.
 */
export const checkForServiceWorkerUpdate = (): Promise<boolean> => {
    const registration = getServiceWorkerRegistration();

    if (!registration) {
        return Promise.resolve(false);
    }

    return registration
        .update()
        .catch(() => undefined)
        .then(() => registration.waiting !== null);
};

/** Tests only: forget the callbacks, the controls and a reload in progress. */
export const resetAppUpdateForTests = (): void => {
    beforeReloadCallbacks.length = 0;
    controls = null;
    isReloading = false;
};
