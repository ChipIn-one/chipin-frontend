import { toast } from 'sonner';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import { initChipInApiInterceptors } from './chipin.interceptors';

const onUnauthorizedSession = vi.fn();

const authSessionMocks = vi.hoisted(() => ({
    currentVersion: 1,
    prepareAuthRequest: vi.fn(() => Promise.resolve('current-access-token')),
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

beforeAll(() => {
    initChipInApiInterceptors(onUnauthorizedSession);
});

beforeEach(() => {
    vi.clearAllMocks();
    authSessionMocks.currentVersion = 1;
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
