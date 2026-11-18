// The update policy of spec 04 §2.11 items 1–3 (04-2d) as a plain controller, created once by
// `ServiceWorkerManager` and driven by its events:
// 1. Detection: at startup (the registration and a worker that was already waiting), on
//    `visibilitychange → visible` (`registration.update()`), and once an hour while online.
// 2. Prompt: the "Update available" toast with "Update" and "Later"; "Later" (or closing it) hides
//    it until the next `visible` after 4 h.
// 3. Forced: a waiting worker first detected more than 24 h ago is applied at the nearest safe
//    point (a route change or `visible`, when `isSafePoint()` holds).
import {
    clearWaitingWorker,
    isForcedUpdateDue,
    isUpdatePromptAllowed,
    noteWaitingWorker,
    snoozeUpdatePrompt,
} from './updatePolicy';

export interface UpdateControllerDeps {
    getRegistration: () => ServiceWorkerRegistration | undefined;
    /** Applies the waiting worker and reloads (`updateServiceWorker(true)`). */
    applyUpdate: () => void;
    isSafePoint: () => boolean;
    isOnline: () => boolean;
    showPrompt: () => void;
    hidePrompt: () => void;
    setUpdateAvailable: (isAvailable: boolean) => void;
    now: () => number;
}

export interface UpdateController {
    /** The worker is registered: a worker already waiting is detected, none restarts the clock. */
    onRegistered: (registration: ServiceWorkerRegistration | undefined) => void;
    /** A new worker is installed and waiting. */
    onWaiting: () => void;
    onVisible: () => void;
    onRouteChange: () => void;
    onHourlyCheck: () => void;
    /** "Update" in the prompt. */
    update: () => void;
    /** "Later" in the prompt, or the prompt closed. */
    later: () => void;
}

// An update check that fails (offline, a server error) changes nothing: the next one runs at the
// next `visible` or hour, and a worker already waiting stays waiting.
const checkForUpdate = (registration: ServiceWorkerRegistration | undefined): void => {
    if (registration) {
        registration.update().catch(() => undefined);
    }
};

export const createUpdateController = (deps: UpdateControllerDeps): UpdateController => {
    let isWaitingDetected = false;
    let isPromptVisible = false;
    let isApplying = false;

    const isWaiting = (): boolean =>
        isWaitingDetected || (deps.getRegistration()?.waiting ?? null) !== null;

    const apply = (): void => {
        if (isApplying) {
            return;
        }
        isApplying = true;
        if (isPromptVisible) {
            isPromptVisible = false;
            deps.hidePrompt();
        }
        deps.applyUpdate();
    };

    const applyIfForced = (): boolean => {
        if (isApplying || !isWaiting() || !isForcedUpdateDue(deps.now()) || !deps.isSafePoint()) {
            return false;
        }
        apply();
        return true;
    };

    const promptIfAllowed = (): void => {
        if (isApplying || isPromptVisible || !isWaiting() || !isUpdatePromptAllowed(deps.now())) {
            return;
        }
        isPromptVisible = true;
        deps.showPrompt();
    };

    const onWaiting = (): void => {
        isWaitingDetected = true;
        noteWaitingWorker(deps.now());
        deps.setUpdateAvailable(true);
        promptIfAllowed();
    };

    return {
        onRegistered: registration => {
            if (registration?.waiting) {
                onWaiting();
            } else if (!isWaitingDetected) {
                clearWaitingWorker();
            }
        },
        onWaiting,
        onVisible: () => {
            checkForUpdate(deps.getRegistration());
            if (!applyIfForced()) {
                promptIfAllowed();
            }
        },
        onRouteChange: () => {
            applyIfForced();
        },
        onHourlyCheck: () => {
            if (deps.isOnline()) {
                checkForUpdate(deps.getRegistration());
            }
        },
        update: apply,
        later: () => {
            if (isApplying) {
                return;
            }
            snoozeUpdatePrompt(deps.now());
            if (isPromptVisible) {
                isPromptVisible = false;
                deps.hidePrompt();
            }
        },
    };
};
