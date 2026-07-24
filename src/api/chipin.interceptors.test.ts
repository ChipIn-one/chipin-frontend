import { toast } from 'sonner';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import { initChipInApiInterceptors } from './chipin.interceptors';

const onUnauthorizedSession = vi.fn();

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

vi.mock('helpers/authSession', () => ({
    prepareAuthRequest: vi.fn(() => Promise.resolve('current-access-token')),
}));

vi.mock('helpers/env', () => ({
    getChipInApiUrl: () => 'https://api.example.test',
}));

vi.mock('helpers/errors', () => ({
    resolveApiErrorMessage: vi.fn(() => 'Localized API error'),
}));

beforeAll(() => {
    initChipInApiInterceptors(onUnauthorizedSession);
});

beforeEach(() => {
    vi.clearAllMocks();
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

test('keeps localized interceptor feedback for retryable validation errors', () => {
    return expect(rejectRequest('/auth/logout-other-devices', 400))
        .rejects.toMatchObject({
            response: { status: 400 },
        })
        .then(() => {
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalledWith(
                'Localized API error',
                expect.any(Object),
            );
        });
});
