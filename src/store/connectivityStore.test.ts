import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { BackendHealthCheckError } from 'api/healthApi';

import { useAuthStore } from './authStore';
import { onConnectivityChange, onResponseSuccess, useConnectivityStore } from './connectivityStore';

const healthMocks = vi.hoisted(() => ({
    probeBackendHealth: vi.fn<() => Promise<'ok' | 'error' | 'unreachable'>>(),
}));

vi.mock('api/healthApi', async importOriginal => ({
    ...(await importOriginal<typeof import('api/healthApi')>()),
    probeBackendHealth: healthMocks.probeBackendHealth,
}));

beforeEach(() => {
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
