// Spec 04 §2.11 item 3 (04-2d): a reload asked by another tab's update waits for a safe point.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    notifyRouteChange,
    onRouteChange,
    reloadAtSafePoint,
    resetSafePointForTests,
    SAFE_RELOAD_MAX_WAIT_MS,
    setSafePointCheck,
} from './safePoint';

const reload = vi.fn();

const preloadError = (): Event => {
    const event = new Event('vite:preloadError', { cancelable: true });

    window.dispatchEvent(event);
    return event;
};

beforeEach(() => {
    vi.useFakeTimers();
    resetSafePointForTests();
    reload.mockClear();
});

afterEach(() => {
    resetSafePointForTests();
    vi.useRealTimers();
});

test('reloads at once at a safe point', () => {
    reloadAtSafePoint(reload);

    expect(reload).toHaveBeenCalledOnce();
});

test('waits while unsafe, reloads at the first safe re-check, at the latest after 30 s', () => {
    const isSafe = vi.fn(() => false);
    setSafePointCheck(isSafe);

    reloadAtSafePoint(reload);
    vi.advanceTimersByTime(SAFE_RELOAD_MAX_WAIT_MS - 1);
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(SAFE_RELOAD_MAX_WAIT_MS);
    expect(reload).toHaveBeenCalledOnce();
});

// R2 LOW-1: the old bundle runs under the new worker while the reload waits.
describe('while a reload waits', () => {
    beforeEach(() => {
        setSafePointCheck(() => false);
        reloadAtSafePoint(reload);
    });

    test('a failed lazy chunk (vite:preloadError) reloads at once, without the error thrown', () => {
        const event = preloadError();

        expect(event.defaultPrevented).toBe(true);
        expect(reload).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(SAFE_RELOAD_MAX_WAIT_MS);
        expect(reload).toHaveBeenCalledOnce();
    });

    test('a route change reloads at once instead of reaching the route listeners', () => {
        const listener = vi.fn();
        onRouteChange(listener);

        notifyRouteChange();

        expect(reload).toHaveBeenCalledOnce();
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('without a waiting reload nothing changes', () => {
    test('a vite:preloadError is left alone', () => {
        const event = preloadError();

        expect(event.defaultPrevented).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    test('a route change reaches the route listeners', () => {
        const listener = vi.fn();
        onRouteChange(listener);

        notifyRouteChange();

        expect(listener).toHaveBeenCalledOnce();
        expect(reload).not.toHaveBeenCalled();
    });

    test('after a finished reload the listeners are gone', () => {
        setSafePointCheck(() => false);
        reloadAtSafePoint(reload);
        preloadError();
        reload.mockClear();

        expect(preloadError().defaultPrevented).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });
});
