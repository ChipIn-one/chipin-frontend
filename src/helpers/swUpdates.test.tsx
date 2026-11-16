import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    activateServiceWorker: vi.fn<() => Promise<void>>(),
    reloadCurrentPage: vi.fn(),
    setIsSwUpdateAvailable: vi.fn(),
    shouldRegisterServiceWorker: vi.fn<(hostname: string) => boolean>(),
    toastCustom: vi.fn(),
    toastDismiss: vi.fn(),
}));

vi.mock('helpers/serviceWorkerRecovery', () => ({
    activateServiceWorker: mocks.activateServiceWorker,
    reloadCurrentPage: mocks.reloadCurrentPage,
}));

vi.mock('helpers/serviceWorkerHost', () => ({
    shouldRegisterServiceWorker: mocks.shouldRegisterServiceWorker,
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
    mocks.shouldRegisterServiceWorker.mockReturnValue(true);
});

// Each test imports a fresh module instance; remove its document listener and interval so a
// later test only sees its own instance's reactions.
afterEach(async () => {
    const { cleanupServiceWorkerUpdates } = await import('./swUpdates');

    cleanupServiceWorkerUpdates();
    vi.restoreAllMocks();
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

test('re-checks the waiting worker on tab focus even when the update request fails', async () => {
    installServiceWorkerRegistration();
    const { initServiceWorkerUpdates } = await import('./swUpdates');

    await initServiceWorkerUpdates();
    const registration = await navigator.serviceWorker.register('/sw.js');
    vi.mocked(registration.update).mockRejectedValueOnce(new Error('offline'));
    mocks.setIsSwUpdateAvailable.mockClear();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => expect(mocks.setIsSwUpdateAvailable).toHaveBeenCalledWith(true));
    expect(registration.update).toHaveBeenCalledOnce();
});

// 04-4a1: the legacy hosts serve the kill-switch at /sw.js, so nothing registers there.
test('registers /sw.js with scope / only when the host allows a worker', async () => {
    installServiceWorkerRegistration();
    const { initServiceWorkerUpdates } = await import('./swUpdates');

    await initServiceWorkerUpdates();

    expect(mocks.shouldRegisterServiceWorker).toHaveBeenCalledWith(window.location.hostname);
    expect(navigator.serviceWorker.register).toHaveBeenCalledExactlyOnceWith('/sw.js', {
        scope: '/',
    });
});

test('does not register a worker on a legacy host', async () => {
    installServiceWorkerRegistration();
    mocks.shouldRegisterServiceWorker.mockReturnValue(false);
    const { initServiceWorkerUpdates } = await import('./swUpdates');

    await initServiceWorkerUpdates();

    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
});
