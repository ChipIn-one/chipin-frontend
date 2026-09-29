import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as authApi from 'api/authApi';
import * as chipinApi from 'api/chipin';
import {
    LS_KEY_AUTH_SESSION_HINT,
    LS_KEY_AUTH_TOKENS,
} from 'constants/localstorage';

import {
    AuthSessionExpiredError,
    clearExpiredAuthSession,
    establishAuthSession,
    getFreshAccessToken,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    startAuthLogout,
    validateAuthSession,
} from './authSession';

const authApiMocks = vi.hoisted(() => ({
    logoutOtherDevices: vi.fn(),
}));

vi.mock('api/authApi', () => authApiMocks);

vi.mock('api/chipin', () => ({
    logoutApiAuthTokens: vi.fn(),
    refreshApiAuthTokens: vi.fn(),
}));

const createAccessToken = (expiresAt: number): string => {
    return `header.${btoa(JSON.stringify({ exp: expiresAt }))}.signature`;
};

describe('authSession', () => {
    let values: Map<string, string>;
    let removeItem: ReturnType<typeof vi.fn>;
    let setItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        values = new Map();
        removeItem = vi.fn((key: string) => values.delete(key));
        setItem = vi.fn((key: string, value: string) => values.set(key, value));
        vi.stubGlobal('localStorage', {
            clear: vi.fn(() => values.clear()),
            getItem: vi.fn((key: string) => values.get(key) ?? null),
            removeItem,
            setItem,
        });
        vi.clearAllMocks();
        invalidateAuthSession();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('restores a reloaded session by refreshing the HttpOnly cookie and clears legacy tokens', () => {
        values.set(
            LS_KEY_AUTH_TOKENS,
            JSON.stringify({
                accessToken: 'legacy-access-token',
                refreshToken: 'legacy-refresh-token',
            }),
        );
        vi.mocked(chipinApi.refreshApiAuthTokens).mockResolvedValue({
            token: 'next-access-token',
        });

        return validateAuthSession().then(accessToken => {
            expect(chipinApi.refreshApiAuthTokens).toHaveBeenCalledWith();
            expect(accessToken).toBe('next-access-token');
            expect(removeItem).toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS);
            expect(values.has(LS_KEY_AUTH_TOKENS)).toBe(false);
            expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('true');
            expect(setItem).not.toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, expect.anything());
        });
    });

    test('keeps a fresh OAuth access token in memory without persisting it', () => {
        const accessToken = createAccessToken(Date.now() / 1000 + 3_600);

        establishAuthSession(accessToken);

        return getFreshAccessToken().then(result => {
            expect(result).toBe(accessToken);
            expect(chipinApi.refreshApiAuthTokens).not.toHaveBeenCalled();
            expect(setItem).not.toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, expect.anything());
        });
    });

    test('shares one in-flight refresh between concurrent callers', () => {
        let resolveRefresh: ((value: { token: string }) => void) | undefined;
        const refreshRequest = new Promise<{ token: string }>(resolve => {
            resolveRefresh = resolve;
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockReturnValue(refreshRequest);

        const firstRequest = validateAuthSession();
        const secondRequest = validateAuthSession();

        expect(chipinApi.refreshApiAuthTokens).toHaveBeenCalledOnce();

        resolveRefresh?.({ token: 'next-access-token' });

        return Promise.all([firstRequest, secondRequest]).then(results => {
            expect(results).toEqual(['next-access-token', 'next-access-token']);
            expect(setItem).not.toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, expect.anything());
        });
    });

    test('clears the in-memory session when refresh is rejected with 401', () => {
        vi.mocked(chipinApi.refreshApiAuthTokens).mockRejectedValue({
            isAxiosError: true,
            response: { status: 401 },
        });

        return validateAuthSession().then(accessToken => {
            expect(accessToken).toBeNull();
            expect(values.has(LS_KEY_AUTH_SESSION_HINT)).toBe(false);
            expect(setItem).not.toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, expect.anything());
        });
    });

    test('reports an expired session when logout-other-devices cannot restore the cookie session', () => {
        vi.mocked(chipinApi.refreshApiAuthTokens).mockRejectedValue({
            isAxiosError: true,
            response: { status: 401 },
        });

        return expect(logoutOtherDevicesSession())
            .rejects.toBeInstanceOf(AuthSessionExpiredError)
            .then(() => {
                expect(authApi.logoutOtherDevices).not.toHaveBeenCalled();
                expect(values.has(LS_KEY_AUTH_SESSION_HINT)).toBe(false);
            });
    });

    test('refreshes an expiring access token before a protected request', () => {
        establishAuthSession(createAccessToken(0));
        vi.mocked(chipinApi.refreshApiAuthTokens).mockResolvedValue({
            token: 'next-access-token',
        });

        return getFreshAccessToken().then(accessToken => {
            expect(accessToken).toBe('next-access-token');
            expect(chipinApi.refreshApiAuthTokens).toHaveBeenCalledOnce();
        });
    });

    test('does not restore a stale refresh after the session was invalidated', () => {
        let resolveRefresh: ((value: { token: string }) => void) | undefined;
        const refreshRequest = new Promise<{ token: string }>(resolve => {
            resolveRefresh = resolve;
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockReturnValue(refreshRequest);

        const validation = validateAuthSession();

        clearExpiredAuthSession();
        resolveRefresh?.({ token: 'stale-access-token' });

        return expect(validation).rejects.toThrow(
            'Auth session changed during token rotation',
        );
    });

    test('does not let an older refresh 401 clear a newer OAuth session', () => {
        let rejectRefresh: ((reason?: unknown) => void) | undefined;
        const refreshRequest = new Promise<{ token: string }>((_resolve, reject) => {
            rejectRefresh = reject;
        });
        vi.mocked(chipinApi.refreshApiAuthTokens).mockReturnValue(refreshRequest);

        const validation = validateAuthSession();
        const newAccessToken = createAccessToken(Date.now() / 1000 + 3_600);

        establishAuthSession(newAccessToken);
        rejectRefresh?.({
            isAxiosError: true,
            response: { status: 401 },
        });

        return expect(validation)
            .rejects.toThrow('Auth session changed during token rotation')
            .then(() => getFreshAccessToken())
            .then(accessToken => {
                expect(accessToken).toBe(newAccessToken);
            });
    });

    test('logs out locally even when the backend logout request fails', () => {
        establishAuthSession(createAccessToken(Date.now() / 1000 + 3_600));
        vi.mocked(chipinApi.logoutApiAuthTokens).mockRejectedValue(
            new Error('network unavailable'),
        );
        vi.mocked(chipinApi.refreshApiAuthTokens).mockRejectedValue({
            isAxiosError: true,
            response: { status: 401 },
        });

        return startAuthLogout()
            .then(() => {
                expect(chipinApi.logoutApiAuthTokens).toHaveBeenCalledWith();
                return getFreshAccessToken();
            })
            .then(accessToken => {
                expect(accessToken).toBeNull();
            });
    });

    test('replaces the in-memory access token after logout-other-devices', () => {
        establishAuthSession(createAccessToken(Date.now() / 1000 + 3_600));
        const nextAccessToken = createAccessToken(Date.now() / 1000 + 7_200);
        vi.mocked(authApi.logoutOtherDevices).mockResolvedValue({
            token: nextAccessToken,
        });

        return logoutOtherDevicesSession()
            .then(() => getFreshAccessToken())
            .then(accessToken => {
                expect(authApi.logoutOtherDevices).toHaveBeenCalledWith();
                expect(accessToken).toBe(nextAccessToken);
                expect(setItem).not.toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, expect.anything());
            });
    });

    test('shares one logout-other-devices request between repeated submissions', () => {
        establishAuthSession(createAccessToken(Date.now() / 1000 + 3_600));
        let resolveRequest: ((value: { token: string }) => void) | undefined;
        const request = new Promise<{ token: string }>(resolve => {
            resolveRequest = resolve;
        });
        vi.mocked(authApi.logoutOtherDevices).mockReturnValue(request);

        const firstRequest = logoutOtherDevicesSession();
        const secondRequest = logoutOtherDevicesSession();

        expect(secondRequest).toBe(firstRequest);

        resolveRequest?.({
            token: createAccessToken(Date.now() / 1000 + 7_200),
        });

        return Promise.all([firstRequest, secondRequest]).then(() => {
            expect(authApi.logoutOtherDevices).toHaveBeenCalledOnce();
        });
    });
});
