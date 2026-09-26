import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    activateServiceWorker: vi.fn<() => Promise<void>>(),
    reloadCurrentPage: vi.fn(),
    setIsSwUpdateAvailable: vi.fn(),
    toastCustom: vi.fn(),
    toastDismiss: vi.fn(),
}));

vi.mock('helpers/serviceWorkerRecovery', () => ({
    activateServiceWorker: mocks.activateServiceWorker,
    reloadCurrentPage: mocks.reloadCurrentPage,
}));

vi.mock('i18n', () => ({
    default: {
        t: (key: string) => key,
    },
}));

vi.mock('sonner', () => ({
    toast: {
        custom: mocks.toastCustom,
        dismiss: mocks.toastDismiss,
    },
}));

vi.mock('store/pwaStore', () => ({
    usePwaStore: {
        getState: () => ({
            setIsSwUpdateAvailable: mocks.setIsSwUpdateAvailable,
        }),
    },
}));

const installServiceWorkerRegistration = (): ServiceWorker => {
    const waitingWorker = new EventTarget() as ServiceWorker;
    const registration = new EventTarget() as ServiceWorkerRegistration;

    Object.defineProperties(registration, {
        installing: { configurable: true, value: null },
        waiting: { configurable: true, value: waitingWorker },
        update: { configurable: true, value: vi.fn(() => Promise.resolve(registration)) },
    });

    const serviceWorker = new EventTarget();

    Object.defineProperties(serviceWorker, {
        controller: { configurable: true, value: {} },
        register: { configurable: true, value: vi.fn(() => Promise.resolve(registration)) },
    });

    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: serviceWorker,
    });

    return waitingWorker;
};

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.activateServiceWorker.mockResolvedValue(undefined);
});

test('applies the shared worker activation before reloading', () => {
    const waitingWorker = installServiceWorkerRegistration();

    return import('./swUpdates')
        .then(({ applySwUpdate, initServiceWorkerUpdates }) =>
            initServiceWorkerUpdates().then(() => {
                applySwUpdate();
            }),
        )
        .then(() => vi.waitFor(() => expect(mocks.reloadCurrentPage).toHaveBeenCalledOnce()))
        .then(() => {
            expect(mocks.activateServiceWorker).toHaveBeenCalledWith(waitingWorker);
            expect(mocks.setIsSwUpdateAvailable).toHaveBeenCalledWith(false);
            expect(mocks.toastDismiss).toHaveBeenCalledOnce();
        });
});

test('reloads safely when shared worker activation fails', () => {
    installServiceWorkerRegistration();
    mocks.activateServiceWorker.mockRejectedValue(new Error('activation failed'));

    return import('./swUpdates')
        .then(({ applySwUpdate, initServiceWorkerUpdates }) =>
            initServiceWorkerUpdates().then(() => {
                applySwUpdate();
            }),
        )
        .then(() => vi.waitFor(() => expect(mocks.reloadCurrentPage).toHaveBeenCalledOnce()));
});
