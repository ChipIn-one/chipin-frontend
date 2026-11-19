// Spec 04 §2.11 (04-2d): the app's reload and service-worker update entry points. The single
// registration lives in `app/pwa/ServiceWorkerManager.tsx`, which hands its `updateServiceWorker`
// and its registration to this module, so the lower layers (the error fallback, the settings page)
// apply an update without importing the `app` layer. An update is always applied here, by posting
// `SKIP_WAITING` to the waiting worker of the registration (the manager's, else the browser's):
// before the window `load` workbox-window has no registration yet and its `messageSkipWaiting()`
// would silently do nothing.
// Every reload path (an applied update, the "update required" button, the error fallback) goes
// through `reloadApp`, which first runs the `onBeforeAppReload` callbacks (04-2d registers the
// expense draft save there).
import * as Sentry from '@sentry/react';

import { SECOND } from 'constants/time';

export interface AppReloadContext {
    /**
     * False for a reload from the error fallback: the open draft may be what crashed the app, so it
     * must not come back after the reload (it would crash again).
     */
    keepDraft: boolean;
}

export interface AppReloadOptions {
    keepDraft?: boolean;
}

type BeforeAppReloadCallback = (context: AppReloadContext) => void;

interface ServiceWorkerControls {
    getRegistration: () => ServiceWorkerRegistration | undefined;
}

/** How long an activated update may take to take control before the page reloads anyway. */
export const UPDATE_ACTIVATION_TIMEOUT_MS = 10 * SECOND;
/** How long `waitForWaitingWorker` waits for a found worker to reach `waiting` by default. */
export const WAITING_WORKER_TIMEOUT_MS = 10 * SECOND;
/** How long the error fallback waits for a found worker to finish installing. */
export const UPDATE_CHECK_TIMEOUT_MS = 8 * SECOND;
const WAITING_POLL_MS = 250;

const beforeReloadCallbacks: BeforeAppReloadCallback[] = [];
let controls: ServiceWorkerControls | null = null;
let isReloading = false;
// Once a reload is asked not to keep the draft (the error fallback), no later reload of this page
// keeps it either: the update path reloads from a `controllerchange` that may come from elsewhere.
let isDraftDropped = false;

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

const noteReloadOptions = (options: AppReloadOptions): void => {
    if (options.keepDraft === false) {
        isDraftDropped = true;
    }
};

const runBeforeAppReload = (): void => {
    const context: AppReloadContext = { keepDraft: !isDraftDropped };

    [...beforeReloadCallbacks].forEach(callback => {
        try {
            callback(context);
        } catch (error: unknown) {
            // One failed callback must not stop the others or the reload.
            Sentry.captureException(error);
        }
    });
};

/** Runs the `onBeforeAppReload` callbacks, then reloads the page; a second call does nothing. */
export const reloadApp = (options: AppReloadOptions = {}): void => {
    noteReloadOptions(options);
    if (isReloading) {
        return;
    }
    isReloading = true;
    runBeforeAppReload();
    window.location.reload();
};

/** Called by `ServiceWorkerManager` once it registered the worker. */
export const setServiceWorkerControls = (next: ServiceWorkerControls | null): void => {
    controls = next;
};

/** The registration of `/sw.js`, once `ServiceWorkerManager` has it. */
export const getServiceWorkerRegistration = (): ServiceWorkerRegistration | undefined =>
    controls?.getRegistration();

const getContainer = (): ServiceWorkerContainer | undefined =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : undefined;

/**
 * The registration of `/sw.js`: the manager's, else the browser's (an app that crashed before the
 * manager got it). Undefined without service worker support or a registration.
 */
export const resolveServiceWorkerRegistration = (): Promise<
    ServiceWorkerRegistration | undefined
> => {
    const known = getServiceWorkerRegistration();

    if (known) {
        return Promise.resolve(known);
    }
    const container = getContainer();

    if (typeof container?.getRegistration !== 'function') {
        return Promise.resolve(undefined);
    }
    return container.getRegistration().catch(() => undefined);
};

/** Whether this page is controlled by a service worker (served from its precache). */
export const isPageControlledByServiceWorker = (): boolean =>
    (getContainer()?.controller ?? null) !== null;

/**
 * Asks the server for `/sw.js` and resolves `true` once a new worker is `waiting` (a found worker
 * goes `installing` → `installed`, which is `waiting`), or `false` after `timeoutMs` (nothing
 * published yet, or offline).
 */
export const waitForWaitingWorker = (
    registration: ServiceWorkerRegistration,
    timeoutMs: number = WAITING_WORKER_TIMEOUT_MS,
): Promise<boolean> =>
    new Promise<boolean>(resolve => {
        let isSettled = false;

        const settle = (hasWaiting: boolean): void => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            window.clearInterval(pollId);
            window.clearTimeout(timeoutId);
            resolve(hasWaiting);
        };
        const check = (): void => {
            if (registration.waiting) {
                settle(true);
            }
        };
        const pollId = window.setInterval(check, WAITING_POLL_MS);
        const timeoutId = window.setTimeout(() => {
            settle(registration.waiting !== null);
        }, timeoutMs);

        // A failed check (offline) leaves the poll to the timeout: a worker may still finish.
        registration.update().then(check, () => undefined);
        check();
    });

// Reload once the new worker controls the page (`controllerchange`), or after the timeout: the
// user is never stuck on an activation that does not happen. This listener is the only reload of
// a page that no worker controlled (a hard reload): Workbox reports no `controlling` update there.
const reloadOnControllerChange = (options: AppReloadOptions): void => {
    const container = getContainer();
    const onControllerChange = (): void => {
        window.clearTimeout(timeoutId);
        reloadApp(options);
    };
    const timeoutId = window.setTimeout(() => {
        container?.removeEventListener('controllerchange', onControllerChange);
        reloadApp(options);
    }, UPDATE_ACTIVATION_TIMEOUT_MS);

    container?.addEventListener('controllerchange', onControllerChange, { once: true });
};

/**
 * Applies the waiting worker (`SKIP_WAITING`, the message the generated worker listens to) and
 * reloads once it takes control; with `reloadPage` false only the worker is activated. If the new
 * worker does not take control within `UPDATE_ACTIVATION_TIMEOUT_MS`, the page reloads anyway.
 * Without a waiting worker nothing is activated: a page a worker controls is then not reloaded
 * (it would load the same version again, C3-26); a page without one (no SW support) reloads.
 */
export const updateServiceWorker = (
    reloadPage = true,
    options: AppReloadOptions = {},
): Promise<void> => {
    noteReloadOptions(options);

    return resolveServiceWorkerRegistration()
        .then(registration => {
            const waiting = registration?.waiting ?? null;

            if (!waiting) {
                if (reloadPage && !isPageControlledByServiceWorker()) {
                    reloadApp(options);
                }
                return;
            }
            if (reloadPage) {
                reloadOnControllerChange(options);
            }
            waiting.postMessage({ type: 'SKIP_WAITING' });
        })
        .catch((error: unknown) => {
            Sentry.captureException(error);
            if (reloadPage) {
                reloadApp(options);
            }
        });
};

/**
 * Whether a newer worker is waiting: asks the server for `/sw.js` first and waits up to
 * `UPDATE_CHECK_TIMEOUT_MS` for a found worker to be installed. False without a registration.
 */
export const checkForServiceWorkerUpdate = (): Promise<boolean> =>
    resolveServiceWorkerRegistration().then(registration =>
        registration ? waitForWaitingWorker(registration, UPDATE_CHECK_TIMEOUT_MS) : false,
    );

/** Tests only: forget the callbacks, the controls and a reload in progress. */
export const resetAppUpdateForTests = (): void => {
    beforeReloadCallbacks.length = 0;
    controls = null;
    isReloading = false;
    isDraftDropped = false;
};
