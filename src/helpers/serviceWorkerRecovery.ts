const SERVICE_WORKER_TIMEOUT_MS = 8_000;

let updateCheckPromise: Promise<ServiceWorker | null> | null = null;

const waitForInstalledWorker = (
    worker: ServiceWorker,
    registration: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> => {
    if (registration.waiting) {
        return Promise.resolve(registration.waiting);
    }

    if (worker.state === 'installed') {
        return Promise.resolve(worker);
    }

    if (worker.state === 'redundant' || worker.state === 'activated') {
        return Promise.resolve(null);
    }

    return new Promise<ServiceWorker | null>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            worker.removeEventListener('statechange', onStateChange);
            reject(new Error('Service worker installation timed out'));
        }, SERVICE_WORKER_TIMEOUT_MS);

        const onSettle = (waitingWorker: ServiceWorker | null): void => {
            window.clearTimeout(timeoutId);
            worker.removeEventListener('statechange', onStateChange);
            resolve(waitingWorker);
        };

        const onStateChange = (): void => {
            if (registration.waiting) {
                onSettle(registration.waiting);
                return;
            }

            if (worker.state === 'installed') {
                onSettle(worker);
                return;
            }

            if (worker.state === 'redundant' || worker.state === 'activated') {
                onSettle(null);
            }
        };

        worker.addEventListener('statechange', onStateChange);
    });
};

const findWaitingWorker = (
    registration: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> => {
    if (registration.waiting) {
        return Promise.resolve(registration.waiting);
    }

    let discoveredWorker = registration.installing;

    const onUpdateFound = (): void => {
        discoveredWorker = registration.installing;
    };

    registration.addEventListener('updatefound', onUpdateFound);

    return registration
        .update()
        .then(updatedRegistration => {
            if (updatedRegistration.waiting) {
                return updatedRegistration.waiting;
            }

            const installingWorker = updatedRegistration.installing ?? discoveredWorker;

            if (!installingWorker) {
                return null;
            }

            return waitForInstalledWorker(installingWorker, updatedRegistration);
        })
        .finally(() => {
            registration.removeEventListener('updatefound', onUpdateFound);
        });
};

const checkForWaitingWorker = (): Promise<ServiceWorker | null> => {
    if (!navigator.serviceWorker.controller) {
        return Promise.resolve(null);
    }

    let timeoutId: number;

    const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(new Error('Service worker update check timed out'));
        }, SERVICE_WORKER_TIMEOUT_MS);
    });

    const existingUpdate = navigator.serviceWorker
        .getRegistration()
        .then(registration => (registration ? findWaitingWorker(registration) : null));

    return Promise.race([existingUpdate, timeout]).finally(() => {
        window.clearTimeout(timeoutId);
    });
};

const activateServiceWorker = (worker: ServiceWorker): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            reject(new Error('Service worker activation timed out'));
        }, SERVICE_WORKER_TIMEOUT_MS);

        const onControllerChange = (): void => {
            window.clearTimeout(timeoutId);
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            resolve();
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        try {
            worker.postMessage({ type: 'SKIP_WAITING' });
        } catch (error: unknown) {
            window.clearTimeout(timeoutId);
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            reject(error);
        }
    });
};

const checkForServiceWorkerUpdate = (): Promise<ServiceWorker | null> => {
    if (updateCheckPromise) {
        return updateCheckPromise;
    }

    if (typeof navigator.serviceWorker === 'undefined') {
        updateCheckPromise = Promise.resolve(null);
        return updateCheckPromise;
    }

    updateCheckPromise = checkForWaitingWorker().catch(() => null);
    return updateCheckPromise;
};

const reloadCurrentPage = (): void => {
    window.location.reload();
};

export {
    activateServiceWorker,
    checkForServiceWorkerUpdate,
    reloadCurrentPage,
};
