import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as authApi from 'api/authApi';
import * as chipinApi from 'api/chipin';
import { LS_KEY_AUTH_TOKENS } from 'constants/localstorage';

import {
    AuthTokenPersistenceError,
    clearExpiredAuthSession,
    logoutOtherDevicesSession,
    validateAuthSession,
} from './authSession';
import { getAuthTokens, saveAuthTokens } from './localStorage';

const authApiMocks = vi.hoisted(() => {
    class InvalidLogoutOtherDevicesResponseError extends Error {}

    return {
        InvalidLogoutOtherDevicesResponseError,
        logoutOtherDevices: vi.fn(),
    };
});

vi.mock('api/authApi', () => authApiMocks);

vi.mock('api/chipin', () => ({
    logoutApiAuthTokens: vi.fn(),
    refreshApiAuthTokens: vi.fn(),
}));

const createAccessToken = (expiresAt: number) => {
    return `header.${btoa(JSON.stringify({ exp: expiresAt }))}.signature`;
};

describe('authSession', () => {
    let values: Map<string, string>;
    let setItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        values = new Map();
        setItem = vi.fn((key: string, value: string) => {
            values.set(key, value);
        });
        vi.stubGlobal('localStorage', {
            clear: vi.fn(() => values.clear()),
            getItem: vi.fn((key: string) => values.get(key) ?? null),
            removeItem: vi.fn((key: string) => values.delete(key)),
            setItem,
        });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('forces server validation even when the local access token is not expiring', () => {
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockResolvedValue({
            token: 'next-access-token',
            refresh_token: 'next-refresh-token',
        });

        return validateAuthSession().then(tokens => {
            expect(chipinApi.refreshApiAuthTokens).toHaveBeenCalledWith(
                'current-refresh-token',
            );
            expect(tokens).toEqual({
                accessToken: 'next-access-token',
                refreshToken: 'next-refresh-token',
            });
        });
    });

    test('preserves cached tokens when validation fails without a 401 response', () => {
        const currentTokens = {
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        };
        const serviceError = {
            isAxiosError: true,
            response: { status: 500 },
        };
        saveAuthTokens(currentTokens);
        vi.mocked(chipinApi.refreshApiAuthTokens).mockRejectedValue(serviceError);

        return expect(validateAuthSession())
            .rejects.toBe(serviceError)
            .then(() => {
                expect(getAuthTokens()).toEqual(currentTokens);
            });
    });

    test('clears revoked tokens after validation receives 401', () => {
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'revoked-refresh-token',
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockRejectedValue({
            isAxiosError: true,
            response: { status: 401 },
        });

        return validateAuthSession().then(tokens => {
            expect(tokens).toBeNull();
            expect(getAuthTokens()).toBeNull();
        });
    });

    test('does not restore tokens when validation resolves after session expiration', () => {
        let resolveRefresh:
            | ((value: { token: string; refresh_token: string }) => void)
            | undefined;
        const refreshRequest = new Promise<{
            token: string;
            refresh_token: string;
        }>(resolve => {
            resolveRefresh = resolve;
        });
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockReturnValue(refreshRequest);

        const validation = validateAuthSession();

        clearExpiredAuthSession();
        resolveRefresh?.({
            token: 'stale-access-token',
            refresh_token: 'stale-refresh-token',
        });

        return expect(validation)
            .rejects.toThrow('Auth session changed during token rotation')
            .then(() => {
                expect(getAuthTokens()).toBeNull();
            });
    });

    test('uses the current refresh token and persists the rotated pair before resolving', () => {
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockResolvedValue({
            token: 'next-access-token',
            refresh_token: 'next-refresh-token',
        });

        return logoutOtherDevicesSession().then(() => {
            expect(authApi.logoutOtherDevices).toHaveBeenCalledWith('current-refresh-token');
            expect(getAuthTokens()).toEqual({
                accessToken: 'next-access-token',
                refreshToken: 'next-refresh-token',
            });
        });
    });

    test('refreshes an expiring access token before reading the refresh header value', () => {
        saveAuthTokens({
            accessToken: createAccessToken(0),
            refreshToken: 'stale-refresh-token',
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockResolvedValue({
            token: createAccessToken(Date.now() / 1000 + 3_600),
            refresh_token: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockResolvedValue({
            token: 'next-access-token',
            refresh_token: 'next-refresh-token',
        });

        return logoutOtherDevicesSession().then(() => {
            expect(chipinApi.refreshApiAuthTokens).toHaveBeenCalledWith('stale-refresh-token');
            expect(authApi.logoutOtherDevices).toHaveBeenCalledWith('current-refresh-token');
        });
    });

    test('does not continue with a stale refresh token when preflight rotation cannot be saved', () => {
        saveAuthTokens({
            accessToken: createAccessToken(0),
            refreshToken: 'stale-refresh-token',
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockResolvedValue({
            token: createAccessToken(Date.now() / 1000 + 3_600),
            refresh_token: 'current-refresh-token',
        });
        setItem.mockImplementation(() => {
            throw new Error('Storage is unavailable');
        });

        return expect(logoutOtherDevicesSession())
            .rejects.toBeInstanceOf(AuthTokenPersistenceError)
            .then(() => {
                expect(authApi.logoutOtherDevices).not.toHaveBeenCalled();
            });
    });

    test('treats an unusable successful response as a token persistence failure', () => {
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockRejectedValue(
            new authApi.InvalidLogoutOtherDevicesResponseError(),
        );

        return expect(logoutOtherDevicesSession()).rejects.toBeInstanceOf(
            AuthTokenPersistenceError,
        );
    });

    test('shares one in-flight request between repeated submissions', () => {
        let resolveRequest: ((value: { token: string; refresh_token: string }) => void) | undefined;
        const request = new Promise<{ token: string; refresh_token: string }>(resolve => {
            resolveRequest = resolve;
        });

        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockReturnValue(request);

        const firstRequest = logoutOtherDevicesSession();
        const secondRequest = logoutOtherDevicesSession();

        expect(secondRequest).toBe(firstRequest);

        return Promise.resolve()
            .then(() => {
                expect(authApi.logoutOtherDevices).toHaveBeenCalledOnce();
                resolveRequest?.({
                    token: 'next-access-token',
                    refresh_token: 'next-refresh-token',
                });
            })
            .then(() => Promise.all([firstRequest, secondRequest]));
    });

    test('does not restore tokens when logout-other-devices resolves after expiration', () => {
        let resolveRequest:
            | ((value: { token: string; refresh_token: string }) => void)
            | undefined;
        const request = new Promise<{
            token: string;
            refresh_token: string;
        }>(resolve => {
            resolveRequest = resolve;
        });
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockReturnValue(request);

        const logoutOtherDevices = logoutOtherDevicesSession();

        return Promise.resolve()
            .then(() => {
                clearExpiredAuthSession();
                resolveRequest?.({
                    token: 'stale-access-token',
                    refresh_token: 'stale-refresh-token',
                });

                return expect(logoutOtherDevices).rejects.toThrow(
                    'Auth session changed during token rotation',
                );
            })
            .then(() => {
                expect(getAuthTokens()).toBeNull();
            });
    });

    test('rejects when the rotated pair cannot be persisted and allows a later retry', () => {
        saveAuthTokens({
            accessToken: createAccessToken(Date.now() / 1000 + 3_600),
            refreshToken: 'current-refresh-token',
        });
        vi.mocked(authApi.logoutOtherDevices).mockResolvedValue({
            token: 'next-access-token',
            refresh_token: 'next-refresh-token',
        });
        setItem.mockImplementation(() => {
            throw new Error('Storage is unavailable');
        });

        return expect(logoutOtherDevicesSession())
            .rejects.toBeInstanceOf(AuthTokenPersistenceError)
            .then(() => {
                setItem.mockImplementation((key: string, value: string) => {
                    values.set(key, value);
                });
                values.set(
                    LS_KEY_AUTH_TOKENS,
                    JSON.stringify({
                        accessToken: createAccessToken(Date.now() / 1000 + 3_600),
                        refreshToken: 'retry-refresh-token',
                    }),
                );

                return logoutOtherDevicesSession();
            })
            .then(() => {
                expect(authApi.logoutOtherDevices).toHaveBeenCalledTimes(2);
                expect(authApi.logoutOtherDevices).toHaveBeenLastCalledWith(
                    'retry-refresh-token',
                );
            });
    });
});
