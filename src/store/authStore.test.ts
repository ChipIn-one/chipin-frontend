import { beforeEach, describe, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import * as authSession from 'helpers/authSession';

import { useAuthStore } from './authStore';
import { APP_MODES, useDashboardStore } from './dashboardStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const authSessionMocks = vi.hoisted(() => {
    class AuthSessionExpiredError extends Error {}
    class AuthSessionPersistenceError extends Error {}

    return {
        AuthSessionExpiredError,
        AuthSessionPersistenceError,
        clearExpiredAuthSession: vi.fn(),
        establishAuthSession: vi.fn(),
        getFreshAccessToken: vi.fn(),
        invalidateAuthSession: vi.fn(),
        logoutOtherDevicesSession: vi.fn(),
        startAuthLogout: vi.fn(),
        validateAuthSession: vi.fn(),
    };
});

vi.mock('helpers/authSession', () => authSessionMocks);
vi.mock('api/chipin', () => ({
    exchangeApiGoogleOAuthCode: vi.fn(),
}));

const mockAuthenticatedDataFetches = (): void => {
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    vi.spyOn(useUsersStore.getState(), 'fetchSetUser').mockResolvedValue(user);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();
};

describe('authStore', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        authSessionMocks.clearExpiredAuthSession.mockResolvedValue(undefined);
        authSessionMocks.startAuthLogout.mockResolvedValue(undefined);
        useLoadingStore.getState().setInitialLoadingStore();
        useAuthStore.setState({
            isNewUser: null,
            status: 'authenticated',
            unauthReason: undefined,
        });
    });

    test('keeps the current device authenticated after logout-other-devices succeeds', () => {
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

    test('establishes OAuth with an access token only', () => {
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: 'access-token',
            is_new_user: false,
        });
        useDashboardStore.setState({ appMode: APP_MODES.GROUP });
        const setDefaultAppMode = vi.spyOn(
            useDashboardStore.getState(),
            'setDefaultAppMode',
        );
        mockAuthenticatedDataFetches();

        return useAuthStore.getState().exchangeGoogleOAuthCode('oauth-code').then(() => {
            expect(authSession.establishAuthSession).toHaveBeenCalledWith('access-token');
            expect(setDefaultAppMode).toHaveBeenCalledWith(true);
        });
    });

    test('cleans up the cookie session when the restore hint cannot be persisted', () => {
        const persistenceError = new authSession.AuthSessionPersistenceError();
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: 'access-token',
            is_new_user: false,
        });
        vi.mocked(authSession.establishAuthSession).mockImplementation(() => {
            throw persistenceError;
        });

        return expect(useAuthStore.getState().exchangeGoogleOAuthCode('oauth-code'))
            .rejects.toBe(persistenceError)
            .then(() => {
                expect(authSession.startAuthLogout).toHaveBeenCalledOnce();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'persistence_error',
                });
            });
    });

    test('loads the premium promo counter after a new registration', () => {
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: 'access-token',
            is_new_user: true,
        });
        mockAuthenticatedDataFetches();
        const fetchSetPremiumPromoRemaining = vi
            .spyOn(useUsersStore.getState(), 'fetchSetPremiumPromoRemaining')
            .mockResolvedValue();

        return useAuthStore.getState().exchangeGoogleOAuthCode('oauth-code').then(() => {
            expect(fetchSetPremiumPromoRemaining).toHaveBeenCalledOnce();
        });
    });

    test('expires the session after logout-other-devices receives 401', () => {
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
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'expired',
                });
            });
    });

    test('expires the session when logout-other-devices cannot restore the cookie session', () => {
        const expiredError = new authSession.AuthSessionExpiredError();
        vi.mocked(authSession.logoutOtherDevicesSession).mockRejectedValue(expiredError);

        return expect(useAuthStore.getState().logoutOtherDevices())
            .rejects.toBe(expiredError)
            .then(() => {
                expect(authSession.clearExpiredAuthSession).toHaveBeenCalledOnce();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'expired',
                });
            });
    });

    test('keeps the current session after a retryable logout-other-devices error', () => {
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
            });
    });

    test('restores authentication from a successful cookie refresh', () => {
        vi.mocked(authSession.validateAuthSession).mockResolvedValue('next-access-token');

        return useAuthStore
            .getState()
            .refreshAuthTokens()
            .then(accessToken => {
                expect(accessToken).toBe('next-access-token');
                expect(useAuthStore.getState().status).toBe('authenticated');
            });
    });

    test('does not authenticate from stale client state when refresh is unavailable', () => {
        const validationError = new Error('Refresh unavailable');
        useAuthStore.setState({
            status: 'unknown',
            unauthReason: undefined,
        });
        vi.mocked(authSession.validateAuthSession).mockRejectedValue(validationError);

        return expect(useAuthStore.getState().refreshAuthTokens())
            .rejects.toBe(validationError)
            .then(() => {
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unknown',
                    unauthReason: undefined,
                });
            });
    });

    test('expires the session when the cookie refresh returns no access token', () => {
        vi.mocked(authSession.validateAuthSession).mockResolvedValue(null);

        return expect(useAuthStore.getState().refreshAuthTokens())
            .rejects.toThrow('Auth session is missing or expired')
            .then(() => {
                expect(authSession.invalidateAuthSession).toHaveBeenCalledOnce();
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'expired',
                });
            });
    });
});
