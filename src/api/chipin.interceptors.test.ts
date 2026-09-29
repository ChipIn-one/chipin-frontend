import { toast } from 'sonner';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { apiInstance, publicApiInstance } from './chipin.instance';
import { initChipInApiInterceptors } from './chipin.interceptors';

const onUnauthorizedSession = vi.fn();

const authSessionMocks = vi.hoisted(() => ({
    accessToken: 'current-access-token',
    currentVersion: 1,
    signedOut: false,
    prepareAuthRequest: vi.fn<() => Promise<string | null | undefined>>(),
    refreshAuthSession: vi.fn<() => Promise<string | null>>(),
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
    isAuthSessionSignedOut: () => authSessionMocks.signedOut,
    prepareAuthRequest: authSessionMocks.prepareAuthRequest,
    refreshAuthSession: authSessionMocks.refreshAuthSession,
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
    authSessionMocks.accessToken = 'current-access-token';
    authSessionMocks.currentVersion = 1;
    authSessionMocks.signedOut = false;
    authSessionMocks.prepareAuthRequest.mockImplementation(() =>
        Promise.resolve(authSessionMocks.accessToken),
    );
    authSessionMocks.refreshAuthSession.mockImplementation(() => {
        authSessionMocks.accessToken = 'next-access-token';
        return Promise.resolve('next-access-token');
    });
    backendAvailabilityMocks.checkBackendHealth.mockResolvedValue(undefined);
    useBackendAvailabilityStore.setState({ isUnavailable: false });
});

const unauthorizedResponse = (config: object) => ({
    config,
    isAxiosError: true,
    response: {
        data: { code: 'AUTH.UNAUTHORIZED' },
        status: 401,
    },
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

test('refreshes once and retries a protected request after 401', () => {
    let attempts = 0;
    const authorizationHeaders: Array<string | undefined> = [];

    return apiInstance
        .request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                attempts += 1;
                authorizationHeaders.push(config.headers.Authorization?.toString());

                if (attempts === 1) {
                    return Promise.reject(unauthorizedResponse(config));
                }

                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(attempts).toBe(2);
            expect(authorizationHeaders).toEqual([
                'Bearer current-access-token',
                'Bearer next-access-token',
            ]);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test('does not loop when the retried protected request is still unauthorized', () => {
    let attempts = 0;

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                attempts += 1;
                return Promise.reject(unauthorizedResponse(config));
            },
        }),
    )
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(attempts).toBe(2);
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('expires the session when refresh cannot restore a protected request', () => {
    authSessionMocks.refreshAuthSession.mockResolvedValue(null);

    return expect(rejectRequest('/dashboard', 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('expires the session when a protected request cannot restore the cookie session before sending', () => {
    let adapterCalls = 0;
    authSessionMocks.prepareAuthRequest.mockResolvedValue(null);

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                adapterCalls += 1;
                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        }),
    )
        .rejects.toThrow('Auth request cancelled')
        .then(() => {
            expect(adapterCalls).toBe(0);
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('preserves an explicit signed-out state when a late protected request is cancelled', () => {
    let adapterCalls = 0;
    authSessionMocks.signedOut = true;
    authSessionMocks.prepareAuthRequest.mockResolvedValue(null);

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                adapterCalls += 1;
                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        }),
    )
        .rejects.toThrow('Auth request cancelled')
        .then(() => {
            expect(adapterCalls).toBe(0);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
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
        adapter: config =>
            new Promise((_resolve, reject) => {
                rejectResponse = () => reject(unauthorizedResponse(config));
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
            expect(authSessionMocks.refreshAuthSession).not.toHaveBeenCalled();
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test.each([
    '/auth/logout',
    '/auth/oauth/google/exchange',
    '/auth/refresh',
    '/auth/logout-other-devices',
])('leaves %s 401 to its owning auth flow', url => {
    return expect(rejectRequest(url, 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).not.toHaveBeenCalled();
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
        });
});

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
