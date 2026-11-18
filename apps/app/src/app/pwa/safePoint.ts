// Spec 04 §2.11 item 3 (04-2d): the "safe point" of a forced update. The service worker manager is
// mounted once per page (above the per-user router), so the app shell reports its route changes and
// its safety check here (`ServiceWorkerSafePoints`). Nothing here imports the app's stores: the
// prerendered landing mounts the manager too and stays without them.
type SafePointCheck = () => boolean;

let safePointCheck: SafePointCheck | null = null;
const routeChangeListeners = new Set<() => void>();

/** The app shell sets its check while mounted (`null` on unmount). */
export const setSafePointCheck = (check: SafePointCheck | null): void => {
    safePointCheck = check;
};

/** True without an app shell (the public landing has no mutations, modals or outbox). */
export const isAtSafePoint = (): boolean => (safePointCheck ? safePointCheck() : true);

/** The app shell navigated to another route. */
export const notifyRouteChange = (): void => {
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
