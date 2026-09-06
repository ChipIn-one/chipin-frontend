import { beforeEach, expect, test, vi } from 'vitest';

import { useAuthStore } from './authStore';
import { useBackendAvailabilityStore } from './backendAvailabilityStore';

const healthMocks = vi.hoisted(() => ({
    checkBackendHealth: vi.fn<() => Promise<void>>(),
}));

vi.mock('api/healthApi', () => ({
    checkBackendHealth: healthMocks.checkBackendHealth,
}));

beforeEach(() => {
    useBackendAvailabilityStore.setState({ isUnavailable: false });
    healthMocks.checkBackendHealth.mockResolvedValue(undefined);
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isNewUser: false,
    });
});

test('changes only availability state and preserves the authenticated session', () => {
    useBackendAvailabilityStore.getState().setUnavailable();

    expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        isNewUser: false,
    });
});

test('clears unavailable state after a successful health retry', () => {
    useBackendAvailabilityStore.setState({ isUnavailable: true });

    return useBackendAvailabilityStore.getState().retryBackendHealth().then(() => {
        expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(false);
    });
});
