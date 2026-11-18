// Spec 04 §2.11 (04-2d): every reload path runs the `onBeforeAppReload` callbacks first.
import * as Sentry from '@sentry/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    checkForServiceWorkerUpdate,
    onBeforeAppReload,
    reloadApp,
    resetAppUpdateForTests,
    setServiceWorkerControls,
    UPDATE_ACTIVATION_TIMEOUT_MS,
    UPDATE_CHECK_TIMEOUT_MS,
    updateServiceWorker,
} from './appUpdate';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const reload = vi.fn();
let container: EventTarget;

beforeEach(() => {
    vi.useFakeTimers();
    resetAppUpdateForTests();
    reload.mockClear();
    container = new EventTarget();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: container });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetAppUpdateForTests();
});

describe('onBeforeAppReload', () => {
    test('runs the callbacks in registration order before the reload, once', () => {
        const calls: string[] = [];

        onBeforeAppReload(() => calls.push('first'));
        onBeforeAppReload(() => calls.push('second'));
        reload.mockImplementation(() => calls.push('reload'));

        reloadApp();
        reloadApp();

        expect(calls).toEqual(['first', 'second', 'reload']);
    });

    test('a failing callback is reported and does not stop the others or the reload', () => {
        const error = new Error('save failed');
        const later = vi.fn();

        onBeforeAppReload(() => {
            throw error;
        });
        onBeforeAppReload(later);

        reloadApp();

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(later).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
    });

    test('an unsubscribed callback does not run', () => {
        const callback = vi.fn();
        const unsubscribe = onBeforeAppReload(callback);

        unsubscribe();
        reloadApp();

        expect(callback).not.toHaveBeenCalled();
    });
});

const waitingWorker = () => ({ postMessage: vi.fn() });

/** The browser's registration (`navigator.serviceWorker.getRegistration()`), `controller` set. */
const browserRegistration = (waiting: { postMessage: () => void } | null, controlled = true) => {
    vi.stubGlobal('navigator', {
        ...navigator,
        serviceWorker: Object.assign(container, {
            controller: controlled ? {} : null,
            getRegistration: () => Promise.resolve({ waiting }),
        }),
    });
};

describe('updateServiceWorker', () => {
    test('without any registration (no SW) it only reloads, through the callbacks', async () => {
        const saved = vi.fn();
        onBeforeAppReload(saved);

        await updateServiceWorker(true);

        expect(saved).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
    });

    test("posts SKIP_WAITING to the manager's waiting worker and reloads when it takes control", async () => {
        const worker = waitingWorker();
        const calls: string[] = [];
        setServiceWorkerControls({
            getRegistration: () => ({ waiting: worker }) as unknown as ServiceWorkerRegistration,
        });
        onBeforeAppReload(() => calls.push('save'));
        reload.mockImplementation(() => calls.push('reload'));

        await updateServiceWorker(true);
        expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' });
        expect(calls).toEqual([]);

        container.dispatchEvent(new Event('controllerchange'));
        expect(calls).toEqual(['save', 'reload']);

        vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
        expect(reload).toHaveBeenCalledOnce();
    });

    // R2 MEDIUM-1: before the window `load` the manager has no registration yet (workbox-window's
    // skip-waiting would be lost); the browser's registration is used.
    test("before load (the manager has no registration) it uses the browser's waiting worker", async () => {
        const worker = waitingWorker();
        setServiceWorkerControls({ getRegistration: () => undefined });
        browserRegistration(worker);

        await updateServiceWorker(true);
        expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' });
        expect(reload).not.toHaveBeenCalled();

        container.dispatchEvent(new Event('controllerchange'));
        expect(reload).toHaveBeenCalledOnce();
    });

    test('reloads after the timeout when the new worker never takes control', async () => {
        browserRegistration(waitingWorker());

        await updateServiceWorker(true);
        vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS - 1);
        expect(reload).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(reload).toHaveBeenCalledOnce();
    });

    test('a controlled page without a waiting worker is not reloaded (C3-26)', async () => {
        setServiceWorkerControls({ getRegistration: () => undefined });
        browserRegistration(null);

        await updateServiceWorker(true);
        vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);

        expect(reload).not.toHaveBeenCalled();
    });

    test('a failed activation is reported and still reloads', async () => {
        const error = new Error('worker gone');
        browserRegistration({
            postMessage: () => {
                throw error;
            },
        });

        await updateServiceWorker(true);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(reload).toHaveBeenCalledOnce();
    });
});

describe('checkForServiceWorkerUpdate', () => {
    test('is false without a registration', async () => {
        await expect(checkForServiceWorkerUpdate()).resolves.toBe(false);
    });

    test('a failed check (offline) without a waiting worker is false after the timeout', async () => {
        const registration = {
            waiting: null,
            update: vi.fn(() => Promise.reject(new Error('offline'))),
        };
        setServiceWorkerControls({
            getRegistration: () => registration as unknown as ServiceWorkerRegistration,
        });

        const result = checkForServiceWorkerUpdate();
        await vi.advanceTimersByTimeAsync(UPDATE_CHECK_TIMEOUT_MS);

        await expect(result).resolves.toBe(false);
        expect(registration.update).toHaveBeenCalledOnce();
    });

    // H1: the app crashed before the manager handed its registration over.
    test('without the manager it reads the browser registration and waits for installing → installed', async () => {
        const registration = {
            waiting: null as ServiceWorker | null,
            installing: {} as ServiceWorker | null,
            update: vi.fn(() => Promise.resolve()),
        };
        vi.stubGlobal('navigator', {
            ...navigator,
            serviceWorker: Object.assign(container, {
                getRegistration: () => Promise.resolve(registration),
            }),
        });

        const result = checkForServiceWorkerUpdate();
        await vi.advanceTimersByTimeAsync(1_000);
        // The found worker finished installing: it is the waiting one now.
        registration.installing = null;
        registration.waiting = {} as ServiceWorker;
        await vi.advanceTimersByTimeAsync(250);

        await expect(result).resolves.toBe(true);
    });
});

// L5: a page loaded by a hard reload has no controller, so Workbox reports no `controlling` update
// (vite-plugin-pwa's `onNeedReload` never runs): only this listener reloads it.
test('on a page no worker controls, the controllerchange listener alone reloads after Update', async () => {
    browserRegistration(waitingWorker(), false);

    await updateServiceWorker(true);
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledOnce();
});

// M1: the error fallback reloads without the draft, also through a later update reload.
describe('keepDraft', () => {
    test('callbacks get keepDraft: true by default', () => {
        const callback = vi.fn();
        onBeforeAppReload(callback);

        reloadApp();

        expect(callback).toHaveBeenCalledExactlyOnceWith({ keepDraft: true });
    });

    test('reloadApp({ keepDraft: false }) passes it to the callbacks', () => {
        const callback = vi.fn();
        onBeforeAppReload(callback);

        reloadApp({ keepDraft: false });

        expect(callback).toHaveBeenCalledExactlyOnceWith({ keepDraft: false });
    });

    test('an update asked without the draft drops it even when another listener reloads first', async () => {
        const callback = vi.fn();
        onBeforeAppReload(callback);
        browserRegistration(waitingWorker());

        await updateServiceWorker(true, { keepDraft: false });
        // e.g. vite-plugin-pwa's `onNeedReload` → `reloadApp()` without options
        reloadApp();

        expect(callback).toHaveBeenCalledExactlyOnceWith({ keepDraft: false });
    });
});
