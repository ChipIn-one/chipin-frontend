import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as authSession from 'helpers/authSession';
import { clearAuthTokens, getAuthTokens, saveAuthTokens } from 'helpers/localStorage';

import { useAuthStore } from './authStore';
import { useLoadingStore } from './loadingStore';

const authSessionMocks = vi.hoisted(() => {
    class AuthTokenPersistenceError extends Error {}

    return {
        AuthTokenPersistenceError,
        clearExpiredAuthSession: vi.fn(),
        getFreshAccessToken: vi.fn(),
        invalidateAuthSession: vi.fn(),
        logoutOtherDevicesSession: vi.fn(),
        startAuthLogout: vi.fn(),
        validateAuthSession: vi.fn(),
    };
});

vi.mock('helpers/authSession', () => authSessionMocks);

describe('authStore.logoutOtherDevices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAuthTokens();
        authSessionMocks.clearExpiredAuthSession.mockImplementation(() => {
            clearAuthTokens();
            return Promise.resolve();
        });
        authSessionMocks.invalidateAuthSession.mockImplementation(() => {
            clearAuthTokens();
        });
        useLoadingStore.getState().setInitialLoadingStore();
        useAuthStore.setState({
            isNewUser: null,
            status: 'authenticated',
            unauthReason: undefined,
        });
    });

    test('tracks loading and keeps the current device authenticated after success', () => {
        vi.mocked(authSession.logoutOtherDevicesSession).mockResolvedValue();

        const request = useAuthStore.getState().logoutOtherDevices();

        expect(useLoadingStore.getState().auth.logoutOtherDevices).toBe('loading');

        return request.then(() => {
            expect(useLoadingStore.getState().auth.logoutOtherDevices).toBe('fetched');
            expect(useAuthStore.getState()).toMatchObject({
                status: 'authenticated',
                unauthReason: undefined,
            });
        });
    });

    test('clears the local session and uses the expired flow after 401', () => {
        saveAuthTokens({
            accessToken: 'current-access-token',
            refreshToken: 'current-refresh-token',
        });
        const unauthorizedError = {
            isAxiosError: true,
            response: { status: 401 },
        };
        vi.mocked(authSession.logoutOtherDevicesSession).mockRejectedValue(
            unauthorizedError,
        );

        return expect(useAuthStore.getState().logoutOtherDevices())
            .rejects.toBe(unauthorizedError)
            .then(() => {
                expect(authSession.clearExpiredAuthSession).toHaveBeenCalledOnce();
                expect(getAuthTokens()).toBeNull();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'expired',
                });
            });
    });

    test('signs out this device when the rotated pair cannot be persisted', () => {
        vi.mocked(authSession.logoutOtherDevicesSession).mockRejectedValue(
            new authSession.AuthTokenPersistenceError(),
        );

        return expect(useAuthStore.getState().logoutOtherDevices())
            .rejects.toBeInstanceOf(authSession.AuthTokenPersistenceError)
            .then(() => {
                expect(authSession.clearExpiredAuthSession).toHaveBeenCalledOnce();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'persistence_error',
                });
            });
    });

    test('leaves the current session authenticated after a retryable validation error', () => {
        const validationError = {
            isAxiosError: true,
            response: { status: 400 },
        };
        vi.mocked(authSession.logoutOtherDevicesSession).mockRejectedValue(validationError);

        return expect(useAuthStore.getState().logoutOtherDevices())
            .rejects.toBe(validationError)
            .then(() => {
                expect(authSession.clearExpiredAuthSession).not.toHaveBeenCalled();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'authenticated',
                    unauthReason: undefined,
                });
                expect(useLoadingStore.getState().auth.logoutOtherDevices).toBe('fetched');
            });
    });

    test('forces server validation when resolving the stored session', () => {
        vi.mocked(authSession.validateAuthSession).mockResolvedValue({
            accessToken: 'next-access-token',
            refreshToken: 'next-refresh-token',
        });

        return useAuthStore
            .getState()
            .refreshAuthTokens()
            .then(accessToken => {
                expect(authSession.validateAuthSession).toHaveBeenCalledOnce();
                expect(accessToken).toBe('next-access-token');
                expect(useAuthStore.getState().status).toBe('authenticated');
            });
    });

    test('keeps cached authentication when server validation is unavailable', () => {
        saveAuthTokens({
            accessToken: 'cached-access-token',
            refreshToken: 'cached-refresh-token',
        });
        vi.mocked(authSession.validateAuthSession).mockRejectedValue(
            { isAxiosError: true },
        );

        return useAuthStore
            .getState()
            .refreshAuthTokens()
            .then(accessToken => {
                expect(accessToken).toBe('cached-access-token');
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'authenticated',
                    unauthReason: undefined,
                });
                expect(getAuthTokens()).toEqual({
                    accessToken: 'cached-access-token',
                    refreshToken: 'cached-refresh-token',
                });
            });
    });

    test.each([400, 403])(
        'does not authenticate from cache after server validation responds with %s',
        status => {
            const validationError = {
                isAxiosError: true,
                response: { status },
            };
            saveAuthTokens({
                accessToken: 'cached-access-token',
                refreshToken: 'cached-refresh-token',
            });
            useAuthStore.setState({
                status: 'unknown',
                unauthReason: undefined,
            });
            vi.mocked(authSession.validateAuthSession).mockRejectedValue(
                validationError,
            );

            return expect(useAuthStore.getState().refreshAuthTokens())
                .rejects.toBe(validationError)
                .then(() => {
                    expect(useAuthStore.getState()).toMatchObject({
                        status: 'unknown',
                        unauthReason: undefined,
                    });
                    expect(getAuthTokens()).toEqual({
                        accessToken: 'cached-access-token',
                        refreshToken: 'cached-refresh-token',
                    });
                });
        },
    );

    test('does not authenticate from cache after a non-network error', () => {
        const validationError = new Error('Unexpected validation failure');
        saveAuthTokens({
            accessToken: 'cached-access-token',
            refreshToken: 'cached-refresh-token',
        });
        useAuthStore.setState({
            status: 'unknown',
            unauthReason: undefined,
        });
        vi.mocked(authSession.validateAuthSession).mockRejectedValue(
            validationError,
        );

        return expect(useAuthStore.getState().refreshAuthTokens())
            .rejects.toBe(validationError)
            .then(() => {
                expect(useAuthStore.getState().status).toBe('unknown');
            });
    });

    test('expires the current session and clears protected state synchronously', () => {
        saveAuthTokens({
            accessToken: 'revoked-access-token',
            refreshToken: 'revoked-refresh-token',
        });

        useAuthStore.getState().expireSession();

        expect(authSession.invalidateAuthSession).toHaveBeenCalledOnce();
        expect(getAuthTokens()).toBeNull();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'expired',
        });
    });
});
