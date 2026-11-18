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

describe('updateServiceWorker', () => {
    test('without a registered worker it only reloads, through the callbacks', async () => {
        const saved = vi.fn();
        onBeforeAppReload(saved);

        await updateServiceWorker(true);

        expect(saved).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
    });

    test('applies the waiting worker and reloads when it takes control', async () => {
        const calls: string[] = [];
        const update = vi.fn(() => {
            calls.push('skipWaiting');
            return Promise.resolve();
        });
        setServiceWorkerControls({ update, getRegistration: () => undefined });
        onBeforeAppReload(() => calls.push('save'));
        reload.mockImplementation(() => calls.push('reload'));

        await updateServiceWorker(true);
        expect(calls).toEqual(['skipWaiting']);

        container.dispatchEvent(new Event('controllerchange'));
        expect(calls).toEqual(['skipWaiting', 'save', 'reload']);

        vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
        expect(reload).toHaveBeenCalledOnce();
    });

    test('reloads after the timeout when the new worker never takes control', async () => {
        setServiceWorkerControls({
            update: () => Promise.resolve(),
            getRegistration: () => undefined,
        });

        await updateServiceWorker(true);
        vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS - 1);
        expect(reload).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(reload).toHaveBeenCalledOnce();
    });

    test('a failed activation is reported and still reloads', async () => {
        const error = new Error('no waiting worker');
        setServiceWorkerControls({
            update: () => Promise.reject(error),
            getRegistration: () => undefined,
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

    test('asks the server first and reports a waiting worker; a failed check reads the state', async () => {
        const registration = {
            waiting: null as ServiceWorker | null,
            update: vi.fn(() => Promise.reject(new Error('offline'))),
        };
        setServiceWorkerControls({
            update: () => Promise.resolve(),
            getRegistration: () => registration as unknown as ServiceWorkerRegistration,
        });

        await expect(checkForServiceWorkerUpdate()).resolves.toBe(false);

        registration.waiting = {} as ServiceWorker;
        await expect(checkForServiceWorkerUpdate()).resolves.toBe(true);
        expect(registration.update).toHaveBeenCalledTimes(2);
    });
});
