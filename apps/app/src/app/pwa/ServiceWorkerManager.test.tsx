// Spec 04 §2.11 (04-2d): the single registration and the wiring of the update policy.
import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { toast } from 'sonner';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { LS_KEY_SW_WAITING_SINCE } from 'constants/localstorage';
import { HOUR } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import {
    getServiceWorkerRegistration,
    onBeforeAppReload,
    resetAppUpdateForTests,
} from 'helpers/appUpdate';
import { LocalStorage } from 'helpers/localStorage';
import { usePwaStore } from 'store/pwaStore';

import { notifyRouteChange, setSafePointCheck } from './safePoint';
import { ServiceWorkerManager } from './ServiceWorkerManager';
import { FORCED_UPDATE_AFTER_MS } from './updatePolicy';

const pwa = vi.hoisted(() => ({
    useRegisterSW: vi.fn(),
    // What `registerSW` does inside the real hook's state initializer: one call per mount.
    register: vi.fn<(options: RegisterSWOptions) => void>(),
    updateServiceWorker: vi.fn(() => Promise.resolve()),
    options: undefined as RegisterSWOptions | undefined,
}));

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: pwa.useRegisterSW }));
vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn() } }));
vi.mock('shared/offline/network', () => ({ isNetworkUsable: vi.fn(() => true) }));

const START = Date.UTC(2026, 10, 19, 12);
const reload = vi.fn();

const fakeRegistration = (waiting: boolean) =>
    ({
        waiting: waiting ? ({} as ServiceWorker) : null,
        update: vi.fn(() => Promise.resolve()),
    }) as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> };

const renderOn = (hostname: string) => {
    vi.stubGlobal('location', { ...window.location, hostname, reload });
    return render(<ServiceWorkerManager />);
};

const registerWith = (registration: ServiceWorkerRegistration) => {
    act(() => {
        pwa.options?.onRegisteredSW?.('/sw.js', registration);
    });
};

const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

beforeEach(() => {
    vi.useFakeTimers({ now: START });
    LocalStorage.clear();
    resetAppUpdateForTests();
    setSafePointCheck(null);
    usePwaStore.setState({ isSwUpdateAvailable: false });
    pwa.options = undefined;
    pwa.useRegisterSW.mockImplementation((options: RegisterSWOptions) => {
        pwa.options = options;
        useState(() => pwa.register(options));
        return {
            needRefresh: [false, vi.fn()],
            offlineReady: [false, vi.fn()],
            updateServiceWorker: pwa.updateServiceWorker,
        };
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    LocalStorage.clear();
    resetAppUpdateForTests();
});

test('registers once on the app host and hands the registration to the update API', () => {
    const { rerender } = renderOn('app.chipin.one');
    rerender(<ServiceWorkerManager />);

    expect(pwa.register).toHaveBeenCalledOnce();

    const registration = fakeRegistration(false);
    registerWith(registration);

    expect(getServiceWorkerRegistration()).toBe(registration);
});

test.each(['chipin.one', 'dev.chipin.one', 'CHIPIN.ONE.'])(
    'registers nothing on the legacy host %s (04-4a1)',
    hostname => {
        renderOn(hostname);

        expect(pwa.useRegisterSW).not.toHaveBeenCalled();
        expect(pwa.register).not.toHaveBeenCalled();
    },
);

test.each(['app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'registers on %s',
    hostname => {
        renderOn(hostname);

        expect(pwa.register).toHaveBeenCalledOnce();
    },
);

test('a waiting worker shows the "Update available" toast and marks the update in settings', () => {
    renderOn('app.chipin.one');
    registerWith(fakeRegistration(true));

    expect(toast.custom).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.custom).mock.calls[0]?.[1]).toMatchObject({
        id: TOASTS_IDS.swUpdate,
        duration: Infinity,
    });
    expect(usePwaStore.getState().isSwUpdateAvailable).toBe(true);
});

test('onNeedRefresh (an update found while open) shows the toast', () => {
    renderOn('app.chipin.one');
    registerWith(fakeRegistration(false));

    act(() => {
        pwa.options?.onNeedRefresh?.();
    });

    expect(toast.custom).toHaveBeenCalledOnce();
});

test('closing the toast counts as "Later"', () => {
    renderOn('app.chipin.one');
    registerWith(fakeRegistration(true));

    act(() => {
        vi.mocked(toast.custom).mock.calls[0]?.[1]?.onDismiss?.({ id: TOASTS_IDS.swUpdate });
    });
    setVisibility('visible');

    expect(toast.custom).toHaveBeenCalledOnce();
});

test('visible checks for an update; hourly checks run while mounted', () => {
    renderOn('app.chipin.one');
    const registration = fakeRegistration(false);
    registerWith(registration);

    setVisibility('hidden');
    expect(registration.update).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(registration.update).toHaveBeenCalledOnce();

    act(() => {
        vi.advanceTimersByTime(HOUR);
    });
    expect(registration.update).toHaveBeenCalledTimes(2);
});

test('the new worker taking control reloads through the onBeforeAppReload callbacks', () => {
    const calls: string[] = [];
    onBeforeAppReload(() => calls.push('save draft'));
    reload.mockImplementation(() => calls.push('reload'));
    renderOn('app.chipin.one');

    pwa.options?.onNeedReload?.();

    expect(calls).toEqual(['save draft', 'reload']);
});

test('a worker waiting for more than 24 h is applied at the next route change at a safe point', () => {
    LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START - FORCED_UPDATE_AFTER_MS - 1);
    const isSafe = vi.fn(() => false);
    setSafePointCheck(isSafe);
    renderOn('app.chipin.one');
    registerWith(fakeRegistration(true));

    act(() => {
        notifyRouteChange();
    });
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    isSafe.mockReturnValue(true);
    act(() => {
        notifyRouteChange();
    });
    expect(pwa.updateServiceWorker).toHaveBeenCalledOnce();
});

test('the toast\'s "Update" applies the waiting worker, "Later" snoozes it', () => {
    renderOn('app.chipin.one');
    registerWith(fakeRegistration(true));

    const renderToast = vi.mocked(toast.custom).mock.calls[0]?.[0];
    const view = render(<>{renderToast?.(TOASTS_IDS.swUpdate)}</>);
    const [later, update] = view.getAllByRole('button');

    act(() => {
        later?.click();
    });
    expect(toast.dismiss).toHaveBeenCalledWith(TOASTS_IDS.swUpdate);
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    act(() => {
        update?.click();
    });
    expect(pwa.updateServiceWorker).toHaveBeenCalledOnce();
});
