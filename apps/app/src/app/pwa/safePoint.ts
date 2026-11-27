// Spec 04 §2.11 item 3 (04-2d): the "safe point" of a forced update. The service worker manager is
// mounted once per page (above the per-user router), so the app shell reports its route changes and
// its safety check here (`ServiceWorkerSafePoints`). Nothing here imports the app's stores.
type SafePointCheck = () => boolean;

let safePointCheck: SafePointCheck | null = null;
const routeChangeListeners = new Set<() => void>();

/** The app shell sets its check while mounted (`null` on unmount). */
export const setSafePointCheck = (check: SafePointCheck | null): void => {
    safePointCheck = check;
};

/** True without an app shell (the public landing has no mutations, modals or outbox). */
export const isAtSafePoint = (): boolean => (safePointCheck ? safePointCheck() : true);

// Set while a reload waits for a safe point (`reloadAtSafePoint`): runs it at once.
let runPendingReload: (() => void) | null = null;

/** The app shell navigated to another route. */
export const notifyRouteChange = (): void => {
    // LOW-1: a waiting reload goes first: the new worker already controls the page and the old
    // version's lazy chunks may be gone, so the next route must load from the new version.
    if (runPendingReload) {
        runPendingReload();
        return;
    }
    routeChangeListeners.forEach(listener => {
        listener();
    });
};

export const onRouteChange = (listener: () => void): (() => void) => {
    routeChangeListeners.add(listener);

    return () => {
        routeChangeListeners.delete(listener);
    };
};

/** M2: how long a reload asked by another tab's update may wait for a safe point. */
export const SAFE_RELOAD_MAX_WAIT_MS = 30_000;
const SAFE_RELOAD_RECHECK_MS = 1_000;
interface PendingSafeReload {
    intervalId: number;
    timeoutId: number;
    onPreloadError: (event: Event) => void;
}

let pendingSafeReload: PendingSafeReload | null = null;

const stopPendingSafeReload = (): void => {
    if (pendingSafeReload) {
        window.clearInterval(pendingSafeReload.intervalId);
        window.clearTimeout(pendingSafeReload.timeoutId);
        window.removeEventListener('vite:preloadError', pendingSafeReload.onPreloadError);
        pendingSafeReload = null;
    }
    runPendingReload = null;
};

/**
 * Runs `reload` at the next safe point of this tab, re-checking every second, and at the latest
 * after `SAFE_RELOAD_MAX_WAIT_MS` (the old version must not stay in control for long). Used when a
 * new worker took control without this tab asking for it (another tab applied the update), so
 * an in-flight mutation or a dirty draft of this tab is not cut off. While it waits the old bundle
 * runs under the new worker, whose precache no longer has the old chunks: a route change or a
 * failed lazy chunk (`vite:preloadError`, its default throw prevented) reloads at once. A second
 * call while one waits does nothing.
 */
export const reloadAtSafePoint = (reload: () => void): void => {
    if (pendingSafeReload) {
        return;
    }
    if (isAtSafePoint()) {
        reload();
        return;
    }
    const finish = (): void => {
        stopPendingSafeReload();
        reload();
    };
    const onPreloadError = (event: Event): void => {
        event.preventDefault();
        finish();
    };

    window.addEventListener('vite:preloadError', onPreloadError);
    runPendingReload = finish;
    pendingSafeReload = {
        intervalId: window.setInterval(() => {
            if (isAtSafePoint()) {
                finish();
            }
        }, SAFE_RELOAD_RECHECK_MS),
        timeoutId: window.setTimeout(finish, SAFE_RELOAD_MAX_WAIT_MS),
        onPreloadError,
    };
};

/** Tests only. */
export const resetSafePointForTests = (): void => {
    stopPendingSafeReload();
    safePointCheck = null;
    routeChangeListeners.clear();
};
