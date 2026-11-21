import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    bootstrapNetwork,
    getLastOfflineAt,
    isNetworkUsable,
    OFFLINE_RECHECK_MS,
    waitForOnline,
} from './network';

const health = vi.hoisted(() => ({
    probeBackendHealth: vi.fn<(sentAfter?: number) => Promise<'ok' | 'error' | 'unreachable'>>(),
}));

vi.mock('shared/api/health', () => ({ probeBackendHealth: health.probeBackendHealth }));

const setNavigatorOnLine = (value: boolean): void => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
};

let teardown: (() => void) | undefined;

beforeEach(() => {
    vi.useFakeTimers();
    onlineManager.setOnline(true);
    health.probeBackendHealth.mockResolvedValue('unreachable');
});

afterEach(() => {
    teardown?.();
    teardown = undefined;
    vi.useRealTimers();
    onlineManager.setOnline(true);
});

describe('bootstrapNetwork', () => {
    test('a cold start with navigator.onLine=false: offline before the first event', () => {
        setNavigatorOnLine(false);

        teardown = bootstrapNetwork();

        expect(onlineManager.isOnline()).toBe(false);
        expect(isNetworkUsable()).toBe(false);
    });

    test('a cold start online stays online and does not probe', async () => {
        setNavigatorOnLine(true);

        teardown = bootstrapNetwork();
        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS * 2);

        expect(onlineManager.isOnline()).toBe(true);
        expect(health.probeBackendHealth).not.toHaveBeenCalled();
    });

    test('offline while the browser says online: /health every 15 s until any answer', async () => {
        setNavigatorOnLine(true);
        teardown = bootstrapNetwork();

        onlineManager.setOnline(false);
        const wentOfflineAt = getLastOfflineAt();
        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS - 1);
        expect(health.probeBackendHealth).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        // Only a probe sent during this outage counts, never an older shared one.
        expect(health.probeBackendHealth).toHaveBeenCalledExactlyOnceWith(wentOfflineAt);
        expect(onlineManager.isOnline()).toBe(false);

        // A non-2xx answer proves the network (not the backend).
        health.probeBackendHealth.mockResolvedValue('error');
        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS);
        expect(health.probeBackendHealth).toHaveBeenCalledTimes(2);
        expect(onlineManager.isOnline()).toBe(true);

        // Online again: the re-check has stopped.
        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS * 3);
        expect(health.probeBackendHealth).toHaveBeenCalledTimes(2);
    });

    test('a re-check answer that a new outage overtook does not end that outage', async () => {
        setNavigatorOnLine(true);
        teardown = bootstrapNetwork();
        let answer: ((health: 'ok') => void) | undefined;
        health.probeBackendHealth.mockReturnValueOnce(
            new Promise(resolve => {
                answer = resolve;
            }),
        );

        onlineManager.setOnline(false);
        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS);
        expect(health.probeBackendHealth).toHaveBeenCalledOnce();
        // Back online and offline again while the probe is still running.
        onlineManager.setOnline(true);
        onlineManager.setOnline(false);
        answer?.('ok');
        await vi.advanceTimersByTimeAsync(0);

        expect(onlineManager.isOnline()).toBe(false);
    });

    test('no probe while the browser itself says offline (it fires `online`)', async () => {
        setNavigatorOnLine(false);
        teardown = bootstrapNetwork();

        await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS * 2);

        expect(health.probeBackendHealth).not.toHaveBeenCalled();
    });
});

describe('waitForOnline', () => {
    test('resolves at once when online', async () => {
        await expect(waitForOnline()).resolves.toBeUndefined();
    });

    test('resolves on reconnect, not before', async () => {
        onlineManager.setOnline(false);
        const settled = vi.fn();

        void waitForOnline().then(settled);
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).not.toHaveBeenCalled();

        onlineManager.setOnline(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toHaveBeenCalledOnce();
    });
});
