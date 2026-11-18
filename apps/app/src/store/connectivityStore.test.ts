import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { BackendHealthCheckError } from 'api/healthApi';

import { useAuthStore } from './authStore';
import { onConnectivityChange, onResponseSuccess, useConnectivityStore } from './connectivityStore';

const healthMocks = vi.hoisted(() => ({
    probeBackendHealth: vi.fn<(sentAfter?: number) => Promise<'ok' | 'error' | 'unreachable'>>(),
}));

vi.mock('api/healthApi', async importOriginal => ({
    ...(await importOriginal<typeof import('api/healthApi')>()),
    probeBackendHealth: healthMocks.probeBackendHealth,
}));

// One mocked clock for the whole file, strictly increasing on every read: the module-level
// cut-offs (last offline, last recovery) can never lie in a later test's future.
let clockMs = 0;

beforeEach(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => (clockMs += 1));
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
    healthMocks.probeBackendHealth.mockResolvedValue('ok');
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isNewUser: false,
    });
});

afterEach(() => {
    onlineManager.setOnline(true);
});

test('backend-down changes only connectivity and preserves the authenticated session', () => {
    onConnectivityChange('backend-down');

    expect(useConnectivityStore.getState().mode).toBe('backend-down');
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', isNewUser: false });
});

test('derives offline from onlineManager and back', () => {
    onlineManager.setOnline(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');

    onlineManager.setOnline(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('an offline classification marks the network unusable in onlineManager', () => {
    onConnectivityChange('offline');

    expect(onlineManager.isOnline()).toBe(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');
});

test('offline wins over backend-down, and reconnecting clears backend-down', () => {
    onConnectivityChange('backend-down');
    onlineManager.setOnline(false);
    onConnectivityChange('backend-down');
    expect(useConnectivityStore.getState().mode).toBe('offline');

    onlineManager.setOnline(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test.each(['request-error', 'client-error'] as const)('%s does not change connectivity', c => {
    onConnectivityChange(c);

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

test('clears backend-down after a successful health retry', async () => {
    useConnectivityStore.setState({ mode: 'backend-down' });

    await useConnectivityStore.getState().retryBackendHealth();

    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('keeps backend-down when /health still answers non-2xx', async () => {
    useConnectivityStore.setState({ mode: 'backend-down' });
    healthMocks.probeBackendHealth.mockResolvedValueOnce('error');

    await expect(useConnectivityStore.getState().retryBackendHealth()).rejects.toBeInstanceOf(
        BackendHealthCheckError,
    );
    expect(useConnectivityStore.getState().mode).toBe('backend-down');
});

test('offline retry, /health non-2xx: the network is back, the backend is down (blocking page)', async () => {
    onConnectivityChange('offline');
    healthMocks.probeBackendHealth.mockResolvedValueOnce('error');

    await expect(useConnectivityStore.getState().retryBackendHealth()).rejects.toBeInstanceOf(
        BackendHealthCheckError,
    );
    expect(onlineManager.isOnline()).toBe(true);
    expect(useConnectivityStore.getState().mode).toBe('backend-down');
});

test('offline retry, /health unreachable: stays offline and rejects (failure text)', async () => {
    onConnectivityChange('offline');
    healthMocks.probeBackendHealth.mockResolvedValueOnce('unreachable');

    await expect(useConnectivityStore.getState().retryBackendHealth()).rejects.toBeInstanceOf(
        BackendHealthCheckError,
    );
    expect(onlineManager.isOnline()).toBe(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');
});

test('a successful response after an offline classification brings the network back', () => {
    onConnectivityChange('offline');
    expect(useConnectivityStore.getState().mode).toBe('offline');

    onResponseSuccess();

    expect(onlineManager.isOnline()).toBe(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('a successful response keeps backend-down while the network is usable', () => {
    onConnectivityChange('backend-down');

    onResponseSuccess();

    expect(useConnectivityStore.getState().mode).toBe('backend-down');
});

test('offline retry, /health 2xx: brings the network back', async () => {
    onConnectivityChange('offline');

    await useConnectivityStore.getState().retryBackendHealth();

    expect(onlineManager.isOnline()).toBe(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('drops a classification of a request that started before the last successful retry', async () => {
    const startedBeforeRetry = performance.now();
    useConnectivityStore.setState({ mode: 'backend-down' });

    await useConnectivityStore.getState().retryBackendHealth();
    onConnectivityChange('backend-down', startedBeforeRetry);
    onConnectivityChange('offline', startedBeforeRetry);

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);

    onConnectivityChange('backend-down', performance.now());
    expect(useConnectivityStore.getState().mode).toBe('backend-down');
});

// #746: a response is evidence only about the network the request was sent on.
test('ignores a success of a request started before the app went offline', () => {
    const startedBeforeOffline = performance.now();
    onlineManager.setOnline(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');

    onResponseSuccess(startedBeforeOffline);

    expect(onlineManager.isOnline()).toBe(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');
});

test('ignores a stale success after an offline classification too', () => {
    const startedBeforeOffline = performance.now();
    onConnectivityChange('offline', performance.now());

    onResponseSuccess(startedBeforeOffline);

    expect(onlineManager.isOnline()).toBe(false);
});

test('a success of a request started after going offline restores online (captive portal)', () => {
    onConnectivityChange('offline', performance.now());

    onResponseSuccess(performance.now());

    expect(onlineManager.isOnline()).toBe(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('a success without a start time restores online (no evidence that it is stale)', () => {
    onlineManager.setOnline(false);

    onResponseSuccess();

    expect(onlineManager.isOnline()).toBe(true);
});

test('every online-to-offline transition moves the cut-off', () => {
    onlineManager.setOnline(false);
    const startedBetweenOutages = performance.now();
    onlineManager.setOnline(true);
    onlineManager.setOnline(false);

    onResponseSuccess(startedBetweenOutages);
    expect(onlineManager.isOnline()).toBe(false);

    onResponseSuccess(performance.now());
    expect(onlineManager.isOnline()).toBe(true);
});

test('the /health retry still brings the network back after a stale success was ignored', async () => {
    const startedBeforeOffline = performance.now();
    onlineManager.setOnline(false);
    onResponseSuccess(startedBeforeOffline);
    expect(onlineManager.isOnline()).toBe(false);

    await useConnectivityStore.getState().retryBackendHealth();

    expect(onlineManager.isOnline()).toBe(true);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('a retry asks for a /health probe sent after the app went offline, never a shared older one', async () => {
    const beforeOffline = performance.now();
    onlineManager.setOnline(false);
    const afterOffline = performance.now();

    await useConnectivityStore.getState().retryBackendHealth();

    const sentAfter = healthMocks.probeBackendHealth.mock.calls[0]?.[0];
    expect(sentAfter).toBeGreaterThan(beforeOffline);
    expect(sentAfter).toBeLessThan(afterOffline);
});

test('a retry whose probe an outage overtook does not end the outage or count as a recovery', async () => {
    useConnectivityStore.setState({ mode: 'backend-down' });
    let answer: ((health: 'ok') => void) | undefined;
    healthMocks.probeBackendHealth.mockReturnValueOnce(
        new Promise(resolve => {
            answer = resolve;
        }),
    );
    const startedBeforeRetry = performance.now();

    const retry = useConnectivityStore.getState().retryBackendHealth();
    onlineManager.setOnline(false);
    answer?.('ok');

    await expect(retry).rejects.toBeInstanceOf(BackendHealthCheckError);
    expect(onlineManager.isOnline()).toBe(false);
    expect(useConnectivityStore.getState().mode).toBe('offline');

    // Not a recovery: an older request's offline classification is still honoured.
    onlineManager.setOnline(true);
    onConnectivityChange('offline', startedBeforeRetry);
    expect(onlineManager.isOnline()).toBe(false);
});
