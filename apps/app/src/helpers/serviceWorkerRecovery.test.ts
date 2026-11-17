import { beforeEach, expect, test, vi } from 'vitest';

interface ServiceWorkerContainerMock extends EventTarget {
    getRegistration: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
}

interface ServiceWorkerMock extends EventTarget {
    postMessage: ReturnType<typeof vi.fn>;
    state: ServiceWorkerState;
}

const createWorker = (state: ServiceWorkerState = 'installed'): ServiceWorkerMock => {
    const worker = new EventTarget() as ServiceWorkerMock;
    worker.postMessage = vi.fn();
    worker.state = state;
    return worker;
};

const createRegistration = (
    overrides: Partial<ServiceWorkerRegistration> = {},
): ServiceWorkerRegistration => {
    const registration = new EventTarget() as ServiceWorkerRegistration;

    Object.defineProperties(registration, {
        installing: { configurable: true, value: null, writable: true },
        waiting: { configurable: true, value: null, writable: true },
        update: { configurable: true, value: vi.fn(() => Promise.resolve(registration)) },
        ...Object.fromEntries(
            Object.entries(overrides).map(([key, value]) => [
                key,
                { configurable: true, value, writable: true },
            ]),
        ),
    });

    return registration;
};

const installServiceWorkerContainer = (
    registration: ServiceWorkerRegistration,
    controller: ServiceWorker | null = {} as ServiceWorker,
): ServiceWorkerContainerMock => {
    const container = new EventTarget() as ServiceWorkerContainerMock;
    container.getRegistration = vi.fn(() => Promise.resolve(registration));
    container.register = vi.fn(() => Promise.resolve(registration));

    Object.defineProperty(container, 'controller', {
        configurable: true,
        value: controller,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
    });

    return container;
};

beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    window.localStorage.clear();
});

test('returns null when no service worker update exists', () => {
    const registration = createRegistration();
    installServiceWorkerContainer(registration);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBeNull();
            expect(registration.update).toHaveBeenCalledOnce();
        });
});

test('does not register a service worker while checking for an update', () => {
    const registration = createRegistration();
    const container = installServiceWorkerContainer(registration);
    container.getRegistration.mockResolvedValue(null);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBeNull();
            expect(container.register).not.toHaveBeenCalled();
        });
});

test('does not expose a first install as an available update', () => {
    const installingWorker = createWorker('installing');
    const registration = createRegistration({
        installing: installingWorker as unknown as ServiceWorker,
    });
    installServiceWorkerContainer(registration, null);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBeNull();
            expect(registration.update).not.toHaveBeenCalled();
        });
});

test('returns null when the service worker API is unavailable', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: undefined,
    });

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBeNull();
        });
});

test('returns a waiting worker without activating it', () => {
    const waitingWorker = createWorker();
    const registration = createRegistration({
        waiting: waitingWorker as unknown as ServiceWorker,
    });
    installServiceWorkerContainer(registration);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBe(waitingWorker);
            expect(waitingWorker.postMessage).not.toHaveBeenCalled();
        });
});

test('waits for a newly discovered worker without activating it', () => {
    const installingWorker = createWorker('installing');
    const registration = createRegistration({
        installing: installingWorker as unknown as ServiceWorker,
    });
    installServiceWorkerContainer(registration);

    return import('./serviceWorkerRecovery').then(({ checkForServiceWorkerUpdate }) => {
        const check = checkForServiceWorkerUpdate();

        return vi
            .waitFor(() => {
                expect(registration.update).toHaveBeenCalledOnce();
            })
            .then(() => {
                installingWorker.state = 'installed';
                Object.defineProperty(registration, 'waiting', {
                    configurable: true,
                    value: installingWorker,
                });
                installingWorker.dispatchEvent(new Event('statechange'));
                return check;
            })
            .then(worker => {
                expect(worker).toBe(installingWorker);
                expect(installingWorker.postMessage).not.toHaveBeenCalled();
            });
    });
});

test('returns null when the update check fails', () => {
    const registration = createRegistration({
        update: vi.fn(() => Promise.reject(new Error('offline'))),
    });
    installServiceWorkerContainer(registration);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => checkForServiceWorkerUpdate())
        .then(worker => {
            expect(worker).toBeNull();
        });
});

test('returns null when the update check times out', () => {
    vi.useFakeTimers();

    const registration = createRegistration({
        update: vi.fn(() => new Promise<ServiceWorkerRegistration>(() => undefined)),
    });
    installServiceWorkerContainer(registration);

    return import('./serviceWorkerRecovery')
        .then(({ checkForServiceWorkerUpdate }) => {
            const check = checkForServiceWorkerUpdate();
            return vi.runAllTimersAsync().then(() => check);
        })
        .then(worker => {
            expect(worker).toBeNull();
        });
});

test('activates the selected worker after control transfers', () => {
    const waitingWorker = createWorker();
    const registration = createRegistration();
    const container = installServiceWorkerContainer(registration);

    waitingWorker.postMessage.mockImplementation(() => {
        queueMicrotask(() => container.dispatchEvent(new Event('controllerchange')));
    });

    return import('./serviceWorkerRecovery')
        .then(({ activateServiceWorker }) =>
            activateServiceWorker(waitingWorker as unknown as ServiceWorker),
        )
        .then(() => {
            expect(waitingWorker.postMessage).toHaveBeenCalledOnce();
            expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        });
});

test('deduplicates update checks and preserves persisted data', () => {
    let resolveUpdate: ((registration: ServiceWorkerRegistration) => void) | undefined;
    const registration = createRegistration({
        update: vi.fn(
            () =>
                new Promise<ServiceWorkerRegistration>(resolve => {
                    resolveUpdate = resolve;
                }),
        ),
    });
    installServiceWorkerContainer(registration);
    window.localStorage.setItem('chipin_tokens', 'auth-value');
    window.localStorage.setItem('unrelated', 'user-value');

    return import('./serviceWorkerRecovery').then(({ checkForServiceWorkerUpdate }) => {
        const firstCheck = checkForServiceWorkerUpdate();
        const secondCheck = checkForServiceWorkerUpdate();

        expect(secondCheck).toBe(firstCheck);

        return vi
            .waitFor(() => {
                expect(registration.update).toHaveBeenCalledOnce();
            })
            .then(() => {
                resolveUpdate?.(registration);
                return firstCheck;
            })
            .then(worker => {
                expect(worker).toBeNull();
                expect(window.localStorage.getItem('chipin_tokens')).toBe('auth-value');
                expect(window.localStorage.getItem('unrelated')).toBe('user-value');
            });
    });
});
