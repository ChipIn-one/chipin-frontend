// Spec 04 §2.11 items 1–3 (04-2d): the update policy.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_SW_UPDATE_DISMISSED_AT, LS_KEY_SW_WAITING_SINCE } from 'constants/localstorage';
import { HOUR } from 'constants/time';
import { LocalStorage } from 'helpers/localStorage';

import { createUpdateController, type UpdateControllerDeps } from './updateController';
import { FORCED_UPDATE_AFTER_MS, MAX_CLOCK_SKEW_MS, UPDATE_SNOOZE_MS } from './updatePolicy';

const START = Date.UTC(2026, 10, 19, 12);

const fakeRegistration = (waiting: boolean) => {
    const update = vi.fn(() => Promise.resolve());

    return {
        registration: {
            waiting: waiting ? ({} as ServiceWorker) : null,
            update,
        } as unknown as ServiceWorkerRegistration,
        update,
    };
};

const setup = (overrides: Partial<UpdateControllerDeps> = {}) => {
    const deps = {
        getRegistration: vi.fn<() => ServiceWorkerRegistration | undefined>(() => undefined),
        applyUpdate: vi.fn(),
        isSafePoint: vi.fn(() => true),
        isOnline: vi.fn(() => true),
        showPrompt: vi.fn(),
        hidePrompt: vi.fn(),
        setUpdateAvailable: vi.fn(),
        now: () => Date.now(),
        ...overrides,
    };

    return { deps, controller: createUpdateController(deps) };
};

beforeEach(() => {
    vi.useFakeTimers({ now: START });
    LocalStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
    LocalStorage.clear();
});

describe('item 1: detection', () => {
    test('a worker already waiting at startup is detected and prompted', () => {
        const { registration } = fakeRegistration(true);
        const { deps, controller } = setup({ getRegistration: () => registration });

        controller.onRegistered(registration);

        expect(deps.setUpdateAvailable).toHaveBeenCalledWith(true);
        expect(deps.showPrompt).toHaveBeenCalledOnce();
        expect(LocalStorage.get(LS_KEY_SW_WAITING_SINCE, 0)).toBe(START);
    });

    test('no waiting worker at startup clears the first-detection stamp', () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START - HOUR);
        const { registration } = fakeRegistration(false);
        const { deps, controller } = setup({ getRegistration: () => registration });

        controller.onRegistered(registration);

        expect(LocalStorage.get(LS_KEY_SW_WAITING_SINCE, 0)).toBe(0);
        expect(deps.showPrompt).not.toHaveBeenCalled();
    });

    test('visible asks the server for an update', () => {
        const { registration, update } = fakeRegistration(false);
        const { controller } = setup({ getRegistration: () => registration });

        controller.onVisible();

        expect(update).toHaveBeenCalledOnce();
    });

    test('the hourly check asks for an update only while online', () => {
        const { registration, update } = fakeRegistration(false);
        const isOnline = vi.fn(() => false);
        const { controller } = setup({ getRegistration: () => registration, isOnline });

        controller.onHourlyCheck();
        expect(update).not.toHaveBeenCalled();

        isOnline.mockReturnValue(true);
        controller.onHourlyCheck();
        expect(update).toHaveBeenCalledOnce();
    });

    test('a failed update check (offline) changes nothing', async () => {
        const { registration, update } = fakeRegistration(false);
        update.mockRejectedValue(new Error('offline'));
        const { deps, controller } = setup({ getRegistration: () => registration });

        controller.onVisible();
        await vi.runAllTimersAsync();

        expect(deps.showPrompt).not.toHaveBeenCalled();
        expect(deps.applyUpdate).not.toHaveBeenCalled();
    });

    test('a later detection keeps the time of the first one', () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START - 2 * HOUR);
        const { controller } = setup();

        controller.onWaiting();

        expect(LocalStorage.get(LS_KEY_SW_WAITING_SINCE, 0)).toBe(START - 2 * HOUR);
    });
});

describe('item 2: the prompt', () => {
    test('a new waiting worker shows the prompt once', () => {
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.onWaiting();
        controller.onVisible();

        expect(deps.showPrompt).toHaveBeenCalledOnce();
    });

    test('"Update" applies the waiting worker once and hides the prompt', () => {
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.update();
        controller.update();

        expect(deps.applyUpdate).toHaveBeenCalledOnce();
        expect(deps.hidePrompt).toHaveBeenCalledOnce();
    });

    test('"Later" hides the prompt until the next visible after 4 h', () => {
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.later();

        expect(deps.hidePrompt).toHaveBeenCalledOnce();
        expect(LocalStorage.get(LS_KEY_SW_UPDATE_DISMISSED_AT, 0)).toBe(START);

        vi.setSystemTime(START + UPDATE_SNOOZE_MS - 1);
        controller.onVisible();
        controller.onWaiting();
        expect(deps.showPrompt).toHaveBeenCalledOnce();

        vi.setSystemTime(START + UPDATE_SNOOZE_MS);
        // Time alone does not bring it back: only the next `visible`.
        vi.advanceTimersByTime(HOUR);
        expect(deps.showPrompt).toHaveBeenCalledOnce();

        controller.onVisible();
        expect(deps.showPrompt).toHaveBeenCalledTimes(2);
    });

    test('a snooze stored by an earlier page holds after a reload', () => {
        LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, START - HOUR);
        const { deps, controller } = setup();

        controller.onWaiting();

        expect(deps.setUpdateAvailable).toHaveBeenCalledWith(true);
        expect(deps.showPrompt).not.toHaveBeenCalled();
    });
});

describe('item 3: the forced update', () => {
    const detectedLongAgo = () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START - FORCED_UPDATE_AFTER_MS - 1);
        LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, START);
    };

    test('after 24 h a route change at a safe point applies the update', () => {
        detectedLongAgo();
        const { deps, controller } = setup();

        controller.onWaiting();
        expect(deps.applyUpdate).not.toHaveBeenCalled();

        controller.onRouteChange();
        expect(deps.applyUpdate).toHaveBeenCalledOnce();
    });

    test('after 24 h a visible at a safe point applies the update', () => {
        detectedLongAgo();
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.onVisible();

        expect(deps.applyUpdate).toHaveBeenCalledOnce();
        expect(deps.showPrompt).not.toHaveBeenCalled();
    });

    test('exactly 24 h is not yet forced', () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START - FORCED_UPDATE_AFTER_MS);
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.onRouteChange();

        expect(deps.applyUpdate).not.toHaveBeenCalled();
    });

    test('an unsafe point blocks it until the next safe one', () => {
        detectedLongAgo();
        const isSafePoint = vi.fn(() => false);
        const { deps, controller } = setup({ isSafePoint });

        controller.onWaiting();
        controller.onRouteChange();
        controller.onVisible();
        expect(deps.applyUpdate).not.toHaveBeenCalled();

        isSafePoint.mockReturnValue(true);
        controller.onRouteChange();
        expect(deps.applyUpdate).toHaveBeenCalledOnce();
    });

    test('without a waiting worker nothing is forced', () => {
        detectedLongAgo();
        const { registration } = fakeRegistration(false);
        const { deps, controller } = setup({ getRegistration: () => registration });

        controller.onRouteChange();

        expect(deps.applyUpdate).not.toHaveBeenCalled();
    });

    test('a worker waiting at startup since more than 24 h waits for a safe point', () => {
        detectedLongAgo();
        const { registration } = fakeRegistration(true);
        const { deps, controller } = setup({ getRegistration: () => registration });

        controller.onRegistered(registration);
        expect(deps.applyUpdate).not.toHaveBeenCalled();

        controller.onRouteChange();
        expect(deps.applyUpdate).toHaveBeenCalledOnce();
    });
});

describe('N1: "Later" is idempotent', () => {
    test('a second "Later" (the toast onDismiss after it was hidden) neither hides nor snoozes again', () => {
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.later();
        vi.setSystemTime(START + HOUR);
        controller.later();

        expect(deps.hidePrompt).toHaveBeenCalledOnce();
        expect(LocalStorage.get(LS_KEY_SW_UPDATE_DISMISSED_AT, 0)).toBe(START);
    });

    test('the onDismiss after "Update" does not snooze', () => {
        const { controller } = setup();

        controller.onWaiting();
        controller.update();
        controller.later();

        expect(LocalStorage.get(LS_KEY_SW_UPDATE_DISMISSED_AT, 0)).toBe(0);
    });
});

describe('L1: a stamp from the future (clock skew) is invalid', () => {
    test('a first-detection stamp later than now + 5 min is rewritten as now', () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START + MAX_CLOCK_SKEW_MS + 1);
        const { deps, controller } = setup();

        controller.onWaiting();
        controller.onRouteChange();

        expect(LocalStorage.get(LS_KEY_SW_WAITING_SINCE, 0)).toBe(START);
        expect(deps.applyUpdate).not.toHaveBeenCalled();

        vi.setSystemTime(START + FORCED_UPDATE_AFTER_MS + 1);
        controller.onRouteChange();
        expect(deps.applyUpdate).toHaveBeenCalledOnce();
    });

    test('a stamp within 5 min ahead is kept', () => {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, START + MAX_CLOCK_SKEW_MS);
        const { controller } = setup();

        controller.onWaiting();

        expect(LocalStorage.get(LS_KEY_SW_WAITING_SINCE, 0)).toBe(START + MAX_CLOCK_SKEW_MS);
    });

    test('a snooze from the future is dropped and the prompt shows', () => {
        LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, START + 10 * HOUR);
        const { deps, controller } = setup();

        controller.onWaiting();

        expect(deps.showPrompt).toHaveBeenCalledOnce();
        expect(LocalStorage.get(LS_KEY_SW_UPDATE_DISMISSED_AT, 0)).toBe(0);
    });
});
