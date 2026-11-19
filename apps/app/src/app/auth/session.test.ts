// Spec 04 §2.3 (04-2a2b): `authReady('/dashboard')` starts the initial session check outside React and resolves
// when the auth store leaves `unknown`, or after 5 s with `UNKNOWN_OFFLINE`.
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage, resetTabUserId } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { loadGroupsListForSession } from 'store/groupsList';
import { loadKnownUsersForSession, loadSelfUserForSession } from 'store/sessionUser';

import { AUTH_READY_TIMEOUT_MS, authReady, UNKNOWN_OFFLINE } from './session';

vi.mock('store/groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('store/groupsList')>()),
    loadGroupsListForSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    loadKnownUsersForSession: vi.fn(() => Promise.resolve()),
    loadSelfUserForSession: vi.fn(() => Promise.resolve(null)),
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

/** A refresh that answers when the test says so. */
const deferredRefresh = () => {
    let answer: (token: string) => void = () => undefined;
    const refreshAuthTokens = vi.fn(
        () =>
            new Promise<string>(resolve => {
                answer = token => {
                    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
                    resolve(token);
                };
            }),
    );

    useAuthStore.setState({ refreshAuthTokens });
    return { refreshAuthTokens, answer: (token: string) => answer(token) };
};

beforeEach(() => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    LocalStorage.remove(LS_KEY_USER);
    resetTabUserId();
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
    useAuthStore.setState({
        status: 'unknown',
        unauthReason: undefined,
        isNewUser: null,
        sessionMode: 'online',
    });
    vi.mocked(loadGroupsListForSession).mockClear();
    vi.mocked(loadSelfUserForSession).mockClear();
    vi.mocked(loadKnownUsersForSession).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    onlineManager.setOnline(true);
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    LocalStorage.remove(LS_KEY_USER);
    resetTabUserId();
});

describe('authReady', () => {
    test('starts the check itself and resolves when the session is resolved', async () => {
        const { refreshAuthTokens, answer } = deferredRefresh();
        const ready = authReady('/dashboard');

        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        answer('access-token');

        await expect(ready).resolves.toEqual({ status: 'authenticated' });
        // The data of the session start is loaded, as `useCheckSignIn` did.
        expect(loadGroupsListForSession).toHaveBeenCalledOnce();
    });

    test('a resolved session resolves at once with the live state, no check', async () => {
        const { refreshAuthTokens } = deferredRefresh();
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

        await expect(authReady('/dashboard')).resolves.toEqual({
            status: 'unauthenticated',
            reason: 'expired',
        });
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('the check starts once for many callers (loader, revalidation, the hook)', async () => {
        const { refreshAuthTokens, answer } = deferredRefresh();
        const first = authReady('/dashboard');
        const second = authReady('/dashboard');

        expect(second).toBe(first);
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        answer('access-token');
        await first;
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });

    test('no session hint: unauthenticated (missing) at once, no refresh', async () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
        const { refreshAuthTokens } = deferredRefresh();

        await expect(authReady('/dashboard')).resolves.toEqual({
            status: 'unauthenticated',
            reason: 'missing',
        });
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('offline cold start of a cached user: authenticated on the cache, no refresh', async () => {
        LocalStorage.set(LS_KEY_USER, { id: 'user-1', role: 'USER', settings });
        resetTabUserId();
        onlineManager.setOnline(false);
        const { refreshAuthTokens } = deferredRefresh();

        await expect(authReady('/dashboard')).resolves.toEqual({ status: 'authenticated' });
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('no answer in 5 s: UNKNOWN_OFFLINE, and later callers do not wait again', async () => {
        vi.useFakeTimers();
        const { refreshAuthTokens } = deferredRefresh();
        let settled = false;
        const ready = authReady('/dashboard').then(session => {
            settled = true;
            return session;
        });

        await vi.advanceTimersByTimeAsync(AUTH_READY_TIMEOUT_MS - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        await expect(ready).resolves.toEqual({ status: UNKNOWN_OFFLINE });
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        await expect(authReady('/dashboard')).resolves.toEqual({ status: UNKNOWN_OFFLINE });
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });

    test('backend down: no refresh, UNKNOWN_OFFLINE after the timeout', async () => {
        vi.useFakeTimers();
        useConnectivityStore.setState({ mode: 'backend-down' });
        const { refreshAuthTokens } = deferredRefresh();
        const ready = authReady('/dashboard');

        await vi.advanceTimersByTimeAsync(AUTH_READY_TIMEOUT_MS);

        await expect(ready).resolves.toEqual({ status: UNKNOWN_OFFLINE });
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('on the OAuth callback it starts no check: the callback page signs in itself', async () => {
        const { refreshAuthTokens } = deferredRefresh();
        const ready = authReady('/oauth/callback');

        expect(refreshAuthTokens).not.toHaveBeenCalled();
        useAuthStore.getState().setAuthenticated();

        await expect(ready).resolves.toEqual({ status: 'authenticated' });
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });
});
