import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { isAdminRole } from 'entities/users';
import * as authSession from 'helpers/authSession';
import { getLocalUser, getTabUserId, saveLocalUser } from 'helpers/localStorage';

import { useAuthStore } from './authStore';
import { useExpenseModalStore } from './expenseModalStore';
import { useLoadingStore } from './loadingStore';
import { loadKnownUsersForSession, loadSelfUserForSession } from './sessionUser';
import { APP_MODES, useUiPrefsStore } from './ui-prefs';

import 'fake-indexeddb/auto';

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
        getAccessTokenSubject: vi.fn(),
        getFreshAccessToken: vi.fn(),
        invalidateAuthSession: vi.fn(),
        logoutOtherDevicesSession: vi.fn(),
        startAuthLogout: vi.fn(),
        validateAuthSession: vi.fn(),
    };
});

vi.mock('helpers/authSession', () => authSessionMocks);
vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({
    exchangeApiGoogleOAuthCode: vi.fn(),
}));
vi.mock('./sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('./sessionUser')>()),
    loadKnownUsersForSession: vi.fn(),
    loadSelfUserForSession: vi.fn(),
}));

const mockAuthenticatedDataFetches = (): void => {
    vi.mocked(loadSelfUserForSession).mockResolvedValue(user);
    vi.mocked(loadKnownUsersForSession).mockResolvedValue();
};

describe('authStore', () => {
    // A sign-out settles after its IndexedDB deletes: a test that does not wait for it must not
    // leave a pending (deduplicated) sign-out to the next one.
    afterEach(() => new Promise<void>(resolve => setTimeout(resolve, 30)));

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        authSessionMocks.clearExpiredAuthSession.mockResolvedValue(undefined);
        authSessionMocks.establishAuthSession.mockImplementation(() => undefined);
        // The token of the cached user: no account switch unless a test says so.
        authSessionMocks.getAccessTokenSubject.mockReturnValue(user.id);
        authSessionMocks.startAuthLogout.mockResolvedValue(undefined);
        useExpenseModalStore.getState().reset();
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
        useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
        const setDefaultAppMode = vi.spyOn(useUiPrefsStore.getState(), 'setDefaultAppMode');
        mockAuthenticatedDataFetches();

        return useAuthStore
            .getState()
            .exchangeGoogleOAuthCode('oauth-code-1')
            .then(() => {
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

        return expect(useAuthStore.getState().exchangeGoogleOAuthCode('oauth-code-2'))
            .rejects.toBe(persistenceError)
            .then(() => {
                expect(authSession.startAuthLogout).toHaveBeenCalledOnce();
                // A persistence_error keeps X's data in the other tabs too: no logout broadcast.
                expect(authSession.startAuthLogout).toHaveBeenCalledWith({ broadcast: false });
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'unauthenticated',
                    unauthReason: 'persistence_error',
                });
            });
    });

    test('loads the self user and the known users once after a sign-in', () => {
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: 'access-token',
            is_new_user: true,
        });
        mockAuthenticatedDataFetches();

        return useAuthStore
            .getState()
            .exchangeGoogleOAuthCode('oauth-code-3')
            .then(() => {
                expect(loadSelfUserForSession).toHaveBeenCalledOnce();
                expect(loadKnownUsersForSession).toHaveBeenCalledOnce();
                // One session start: both reuse what loaded after the same moment.
                const [since] = vi.mocked(loadSelfUserForSession).mock.calls[0] ?? [];
                expect(loadKnownUsersForSession).toHaveBeenCalledWith(since);
                expect(useAuthStore.getState().isNewUser).toBe(true);
            });
    });

    test('expires the session after logout-other-devices receives 401', () => {
        const unauthorizedError = {
            isAxiosError: true,
            response: { status: 401 },
        };
        vi.mocked(authSession.logoutOtherDevicesSession).mockRejectedValue(unauthorizedError);

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

    test('a successful refresh ends an offline-cached session (spec 03 §1.6)', () => {
        useAuthStore.getState().setOfflineCachedSession();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'authenticated',
            sessionMode: 'offline-cached',
        });
        vi.mocked(authSession.validateAuthSession).mockResolvedValue('next-access-token');

        return useAuthStore
            .getState()
            .refreshAuthTokens()
            .then(() => {
                expect(useAuthStore.getState().sessionMode).toBe('online');
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

    test('keeps the expense draft when the session expires (expiry is not a logout)', () => {
        useExpenseModalStore.setState({
            isOpened: true,
            groupId: 'private-group',
            description: 'private expense',
            includedParticipantIds: { 'user-1': true },
        });

        useAuthStore.getState().expireSession();

        expect(useExpenseModalStore.getState()).toMatchObject({
            groupId: 'private-group',
            description: 'private expense',
            includedParticipantIds: { 'user-1': true },
        });
    });

    test('resets protected expense draft data after sign out', () => {
        useExpenseModalStore.setState({
            isOpened: true,
            groupId: 'private-group',
            description: 'private expense',
            includedParticipantIds: { 'user-1': true },
        });

        return useAuthStore
            .getState()
            .signOut()
            .then(() => {
                expect(useExpenseModalStore.getState()).toMatchObject({
                    isOpened: false,
                    groupId: '',
                    description: '',
                    includedParticipantIds: {},
                });
            });
    });

    test('hides protected data immediately and deduplicates repeated sign-out', () => {
        let finish: (() => void) | undefined;
        const pending = new Promise<void>(resolve => {
            finish = resolve;
        });
        authSessionMocks.startAuthLogout.mockReturnValue(pending);
        useExpenseModalStore.setState({
            isOpened: true,
            groupId: 'private-group',
            description: 'private expense',
        });

        const first = useAuthStore.getState().signOut();
        const second = useAuthStore.getState().signOut();
        expect(second).toBe(first);
        expect(authSession.startAuthLogout).toHaveBeenCalledOnce();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
        });
        expect(useExpenseModalStore.getState()).toMatchObject({
            isOpened: false,
            groupId: '',
            description: '',
        });

        finish?.();
        return Promise.all([first, second]).then(() => {
            expect(authSession.startAuthLogout).toHaveBeenCalledOnce();
        });
    });

    test.each([
        ['signOut', () => useAuthStore.getState().signOut()],
        ['expireSession', () => useAuthStore.getState().expireSession()],
    ])('%s drops the cached role but keeps cached settings', (_name, onReset) => {
        saveLocalUser({ role: 'ADMIN', settings: user.settings });

        onReset();

        expect(getLocalUser()).toEqual({ settings: user.settings });
        // Signed out, the UI reads the role from the cached user.
        expect(isAdminRole(getLocalUser()?.role)).toBe(false);
    });

    // Spec 03 §1.5 table, invariant 12: a sign-out drops the cached user `id`; any other
    // transition to unauthenticated keeps it (the user's cache survives an expiry).
    test.each([
        ['signOut (this tab)', () => void useAuthStore.getState().signOut()],
        [
            'remote logout (signed_out)',
            () => useAuthStore.getState().setUnauthenticated('signed_out'),
        ],
    ])('%s drops the cached id and role, keeps settings', (_name, onSignOut) => {
        saveLocalUser({ id: user.id, role: 'ADMIN', settings: user.settings });

        onSignOut();

        expect(getLocalUser()).toEqual({ settings: user.settings });
        expect(getTabUserId()).toBeUndefined();
    });

    test.each([
        ['expireSession', () => useAuthStore.getState().expireSession()],
        ['invalid', () => useAuthStore.getState().setUnauthenticated('invalid')],
        ['expired', () => useAuthStore.getState().setUnauthenticated('expired')],
    ])('%s keeps the cached id, drops only the role', (_name, onReset) => {
        saveLocalUser({ id: user.id, role: 'ADMIN', settings: user.settings });

        onReset();

        expect(getLocalUser()).toEqual({ id: user.id, settings: user.settings });
        expect(getTabUserId()).toBe(user.id);
    });

    test.each([
        ['missing', () => useAuthStore.getState().setUnauthenticated('missing')],
        ['error', () => useAuthStore.getState().setUnauthenticated('error')],
        [
            'persistence_error',
            () => useAuthStore.getState().setUnauthenticated('persistence_error'),
        ],
    ])('%s leaves the cached user unchanged', (_name, onReset) => {
        saveLocalUser({ id: user.id, role: 'ADMIN', settings: user.settings });

        onReset();

        expect(getLocalUser()).toEqual({ id: user.id, role: 'ADMIN', settings: user.settings });
    });

    // The app mode is UI state, but it follows the session: every transition to unauthenticated
    // resets it to the cached user's default (`resetAuthScopedStores`), as before 03-8.
    test.each([
        ['signOut', () => void useAuthStore.getState().signOut()],
        ['remote logout', () => useAuthStore.getState().setUnauthenticated('signed_out')],
        ['expireSession', () => useAuthStore.getState().expireSession()],
        ['invalid', () => useAuthStore.getState().setUnauthenticated('invalid')],
        ['missing', () => useAuthStore.getState().setUnauthenticated('missing')],
        ['error', () => useAuthStore.getState().setUnauthenticated('error')],
    ])('%s resets the app mode to the cached default', (_name, onReset) => {
        saveLocalUser({
            id: user.id,
            settings: { ...user.settings, soloModeByDefault: false },
        });
        useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });

        onReset();

        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.GROUP);
    });

    test('the reset applies a Solo default of the cached settings', () => {
        saveLocalUser({ id: user.id, settings: { ...user.settings, soloModeByDefault: true } });
        useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });

        useAuthStore.getState().expireSession();

        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.SOLO);
    });

    describe('OAuth code dedupe (the remount on the first user id)', () => {
        const tokens = { token: 'access-token', is_new_user: false };

        test('the same code while it is exchanged: one request, one promise', () => {
            vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue(tokens);
            mockAuthenticatedDataFetches();
            const { exchangeGoogleOAuthCode } = useAuthStore.getState();

            const first = exchangeGoogleOAuthCode('dedupe-code');
            const second = exchangeGoogleOAuthCode('dedupe-code');

            expect(second).toBe(first);
            return first.then(() => {
                expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
            });
        });

        test('a failed exchange is not cached: a retry sends a new request', () => {
            vi.mocked(exchangeApiGoogleOAuthCode)
                .mockRejectedValueOnce(new Error('exchange failed'))
                .mockResolvedValueOnce(tokens);
            mockAuthenticatedDataFetches();
            const { exchangeGoogleOAuthCode } = useAuthStore.getState();

            return expect(exchangeGoogleOAuthCode('retried-code'))
                .rejects.toThrow('exchange failed')
                .then(() => exchangeGoogleOAuthCode('retried-code'))
                .then(() => {
                    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledTimes(2);
                    expect(useAuthStore.getState().status).toBe('authenticated');
                });
        });

        test.each([
            ['signOut', () => void useAuthStore.getState().signOut()],
            ['remote logout', () => useAuthStore.getState().setUnauthenticated('signed_out')],
        ])('after %s the same code is not served from the cache', (_name, onSignOut) => {
            vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue(tokens);
            mockAuthenticatedDataFetches();
            const { exchangeGoogleOAuthCode } = useAuthStore.getState();
            const code = `signed-out-code-${_name}`;

            return exchangeGoogleOAuthCode(code)
                .then(() => {
                    onSignOut();
                    return exchangeGoogleOAuthCode(code);
                })
                .then(() => {
                    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledTimes(2);
                });
        });
    });
});
