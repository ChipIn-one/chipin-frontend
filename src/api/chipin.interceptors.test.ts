import { toast } from 'sonner';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { apiInstance, publicApiInstance } from './chipin.instance';
import { initChipInApiInterceptors } from './chipin.interceptors';

const onUnauthorizedSession = vi.fn();

const authSessionMocks = vi.hoisted(() => ({
    currentVersion: 1,
    prepareAuthRequest: vi.fn(() => Promise.resolve('current-access-token')),
}));

const backendAvailabilityMocks = vi.hoisted(() => ({
    checkBackendHealth: vi.fn<() => Promise<void>>(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

vi.mock('helpers/authSession', () => ({
    getAuthSessionVersion: () => authSessionMocks.currentVersion,
    isAuthSessionCurrent: (version: number) => version === authSessionMocks.currentVersion,
    prepareAuthRequest: authSessionMocks.prepareAuthRequest,
}));

vi.mock('helpers/env', () => ({
    getChipInApiUrl: () => 'https://api.example.test',
}));

vi.mock('./healthApi', () => ({
    checkBackendHealth: backendAvailabilityMocks.checkBackendHealth,
}));

beforeAll(() => {
    initChipInApiInterceptors(onUnauthorizedSession);
});

beforeEach(() => {
    vi.clearAllMocks();
    authSessionMocks.currentVersion = 1;
    backendAvailabilityMocks.checkBackendHealth.mockResolvedValue(undefined);
    useBackendAvailabilityStore.setState({ isUnavailable: false });
});

const rejectRequest = (url: string, status: number) => {
    return apiInstance.request({
        method: 'post',
        url,
        adapter: config =>
            Promise.reject({
                config,
                isAxiosError: true,
                response: {
                    data: {
                        code:
                            status === 401
                                ? 'AUTH.UNAUTHORIZED'
                                : 'VALIDATION.INVALID',
                    },
                    status,
                },
            }),
    });
};

const rejectPublicRequest = (url: string, status: number) => {
    return publicApiInstance.request({
        method: 'get',
        url,
        adapter: config =>
            Promise.reject({
                config,
                isAxiosError: true,
                response: { status },
            }),
    });
};

test('expires the current session for a protected request 401 without a generic toast', () => {
    return expect(rejectRequest('/dashboard', 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(onUnauthorizedSession).toHaveBeenCalledTimes(1);
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test('ignores a protected request 401 from an older auth session', () => {
    let rejectResponse: ((reason?: unknown) => void) | undefined;
    let markAdapterStarted: (() => void) | undefined;
    const adapterStarted = new Promise<void>(resolve => {
        markAdapterStarted = resolve;
    });
    const request = apiInstance.request({
        method: 'get',
        url: '/dashboard',
        adapter: config => new Promise((_resolve, reject) => {
            rejectResponse = () => reject({
                config,
                isAxiosError: true,
                response: {
                    data: { code: 'AUTH.UNAUTHORIZED' },
                    status: 401,
                },
            });
            markAdapterStarted?.();
        }),
    });

    return adapterStarted
        .then(() => {
            authSessionMocks.currentVersion = 2;
            rejectResponse?.();
            return expect(request).rejects.toMatchObject({
                response: { status: 401 },
            });
        })
        .then(() => {
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test('expires the current session when refresh validation returns 401', () => {
    return expect(rejectRequest('/auth/refresh', 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(onUnauthorizedSession).toHaveBeenCalledTimes(1);
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test('expires the current session for logout-other-devices 401', () => {
    return expect(rejectRequest('/auth/logout-other-devices', 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(onUnauthorizedSession).toHaveBeenCalledTimes(1);
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test.each(['/auth/logout', '/auth/oauth/google/exchange'])(
    'leaves %s 401 to its owning public auth flow',
    url => {
        return expect(rejectRequest(url, 401))
            .rejects.toMatchObject({
                response: { status: 401 },
            })
            .then(() => {
                expect(onUnauthorizedSession).not.toHaveBeenCalled();
                expect(toast.error).not.toHaveBeenCalled();
            });
    },
);

test('leaves retryable validation feedback to the owning UI flow', () => {
    return expect(rejectRequest('/auth/logout-other-devices', 400))
        .rejects.toMatchObject({
            response: { status: 400 },
        })
        .then(() => {
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test('confirms a likely outage through health before entering unavailable state', () => {
    backendAvailabilityMocks.checkBackendHealth.mockRejectedValueOnce(
        new Error('health unavailable'),
    );

    return expect(rejectRequest('/dashboard', 503))
        .rejects.toMatchObject({
            response: { status: 503 },
        })
        .then(() => {
            expect(backendAvailabilityMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(true);
        });
});

test('keeps the normal error path when health confirms the backend is available', () => {
    return expect(rejectRequest('/dashboard', 503))
        .rejects.toMatchObject({
            response: { status: 503 },
        })
        .then(() => {
            expect(backendAvailabilityMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(false);
        });
});

test('does not confirm health or enter unavailable state for an application 4xx', () => {
    return expect(rejectRequest('/dashboard', 404))
        .rejects.toMatchObject({
            response: { status: 404 },
        })
        .then(() => {
            expect(backendAvailabilityMocks.checkBackendHealth).not.toHaveBeenCalled();
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(false);
        });
});

test('also confirms a likely outage from the public API path', () => {
    backendAvailabilityMocks.checkBackendHealth.mockRejectedValueOnce(
        new Error('health unavailable'),
    );

    return expect(rejectPublicRequest('/stats', 503))
        .rejects.toMatchObject({
            response: { status: 503 },
        })
        .then(() => {
            expect(backendAvailabilityMocks.checkBackendHealth).toHaveBeenCalledOnce();
            expect(useBackendAvailabilityStore.getState().isUnavailable).toBe(true);
        });
});
