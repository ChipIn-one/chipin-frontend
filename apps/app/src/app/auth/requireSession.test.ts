// Spec 04 §2.3, the `requireSession` table (04-2a2b; 04-2f: `SIGNED_OUT` and `MISSING` → `/login`).
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { loginPathFor } from 'helpers/url';
import { clearUserData } from 'shared/offline/clearUserData';
import { startCacheRestore } from 'shared/offline/restore';
import { UNAUTH_REASON, type UnauthReason } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import {
    readSessionEnvironment,
    requireSession,
    type SessionAccess,
    sessionAccess,
} from './requireSession';
import { AUTH_READY_TIMEOUT_MS, readSession, type Session, UNKNOWN_OFFLINE } from './session';

vi.mock('shared/offline/clearUserData', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/offline/clearUserData')>()),
    clearUserData: vi.fn(() => Promise.resolve()),
}));

const SETTINGS = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

const loaderArgs = (path: string) => ({ request: new Request(`http://localhost${path}`) });

const unauth = (reason: UnauthReason): Session => ({ status: 'unauthenticated', reason });
const ENVIRONMENTS = [true, false].flatMap(hasSavedUser =>
    [
        { hasSessionHint: true, isNetworkUsable: true },
        { hasSessionHint: true, isNetworkUsable: false },
        { hasSessionHint: false, isNetworkUsable: true },
        { hasSessionHint: false, isNetworkUsable: false },
    ].map(env => ({ ...env, isLeavingAfterSignOut: false, hasSavedUser })),
);

// Every row of the table, in every environment: [session, online access, hint+offline access with
// a saved user, hint+offline access with no user saved on the device].
const ROWS: [string, Session, SessionAccess, SessionAccess, SessionAccess][] = [
    ['authenticated', { status: 'authenticated' }, 'pass', 'pass', 'pass'],
    ['signed_out', unauth(UNAUTH_REASON.SIGNED_OUT), 'login', 'login', 'login'],
    ['missing', unauth(UNAUTH_REASON.MISSING), 'login', 'login', 'login'],
    ['expired', unauth(UNAUTH_REASON.EXPIRED), 'modalOverPage', 'modalOverPage', 'modalOverPage'],
    ['invalid', unauth(UNAUTH_REASON.INVALID), 'modalOverPage', 'modalOverPage', 'modalOverPage'],
    ['error', unauth(UNAUTH_REASON.ERROR), 'modal', 'pass', 'offlineNoData'],
    [
        'persistence_error',
        unauth(UNAUTH_REASON.PERSISTENCE_ERROR),
        'modal',
        'pass',
        'offlineNoData',
    ],
    [UNKNOWN_OFFLINE, { status: UNKNOWN_OFFLINE }, 'modal', 'pass', 'offlineNoData'],
    ['no reason', { status: 'unauthenticated', reason: undefined }, 'modal', 'modal', 'modal'],
];

describe('sessionAccess', () => {
    test.each(ROWS)(
        'AUTH-071 NET-008 %s: redirect, sign-in, the cached page offline with a hint and a saved user, the offline load error without one',
        (_name, session, otherwise, hintOfflineSaved, hintOfflineNoData) => {
            ENVIRONMENTS.forEach(env => {
                const hintOffline = env.hasSavedUser ? hintOfflineSaved : hintOfflineNoData;
                const expected =
                    env.hasSessionHint && !env.isNetworkUsable ? hintOffline : otherwise;

                expect({ env, access: sessionAccess(session, env) }).toEqual({
                    env,
                    access: expected,
                });
            });
        },
    );

    test('AUTH-071 an explicit sign-out in this tab is leaving, not a /login redirect; only it', () => {
        ENVIRONMENTS.forEach(env => {
            const leaving = { ...env, isLeavingAfterSignOut: true };

            expect(sessionAccess(unauth(UNAUTH_REASON.SIGNED_OUT), leaving)).toBe('leaving');
            expect(sessionAccess(unauth(UNAUTH_REASON.MISSING), leaving)).toBe('login');
        });
    });
});

describe('requireSession', () => {
    beforeAll(() => {
        startCacheRestore(undefined);
    });

    beforeEach(() => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        vi.mocked(clearUserData).mockClear();
    });

    afterEach(() => {
        window.history.replaceState(null, '', '/');
        onlineManager.setOnline(true);
        LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
        LocalStorage.remove(LS_KEY_USER);
    });

    test.each(['signed_out', 'missing'] as const)(
        'AUTH-071 %s on /dashboard redirects to /login?returnTo=%%2Fdashboard',
        async reason => {
            useAuthStore.setState({ status: 'unauthenticated', unauthReason: reason });

            const response = await requireSession(loaderArgs('/dashboard'));

            expect(response?.status).toBe(302);
            expect(response?.headers.get('Location')).toBe('/login?returnTo=%2Fdashboard');
            expect(clearUserData).not.toHaveBeenCalled();
        },
    );

    test('AUTH-075 returnTo keeps the path and the query of a join link', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        const response = await requireSession(loaderArgs('/group/join/tok-1?ref=x'));

        expect(response?.headers.get('Location')).toBe(
            `/login?returnTo=${encodeURIComponent('/group/join/tok-1?ref=x')}`,
        );
    });

    test('AUTH-071 loginPathFor encodes the whole returnTo', () => {
        expect(loginPathFor('/friends/join/a&b?c=d#e')).toBe(
            '/login?returnTo=%2Ffriends%2Fjoin%2Fa%26b%3Fc%3Dd%23e',
        );
    });

    test('AUTH-071 the loader does not redirect an explicit sign-out leaving for the landing', async () => {
        useAuthStore.setState({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
            isLeavingAfterSignOut: true,
        });

        try {
            await expect(requireSession(loaderArgs('/group/1'))).resolves.toBeNull();
        } finally {
            useAuthStore.setState({ isLeavingAfterSignOut: false });
        }
    });

    test.each([
        ['authenticated', undefined],
        ['unauthenticated', 'expired'],
        ['unauthenticated', 'invalid'],
        ['unauthenticated', 'error'],
        ['unauthenticated', 'persistence_error'],
    ] as const)('%s (%s) lets the route render, never deleting data', async (status, reason) => {
        useAuthStore.setState({ status, unauthReason: reason });

        await expect(requireSession(loaderArgs('/dashboard'))).resolves.toBeNull();
        expect(clearUserData).not.toHaveBeenCalled();
    });

    test('hint and offline: an error session goes to the cache, no redirect', async () => {
        onlineManager.setOnline(false);
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'error' });

        await expect(requireSession(loaderArgs('/dashboard'))).resolves.toBeNull();
    });

    test('NET-008 hint, offline, no saved user: the loader resolves at once without a redirect, no 5 s wait', async () => {
        vi.useFakeTimers();
        try {
            onlineManager.setOnline(false);
            useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
            const decision = requireSession(loaderArgs('/dashboard'));
            let isDecided = false;
            void decision.then(() => {
                isDecided = true;
            });

            // No timer runs: only the pending promise callbacks.
            await vi.advanceTimersByTimeAsync(0);

            expect(isDecided).toBe(true);
            await expect(decision).resolves.toBeNull();
            expect(readSessionEnvironment()).toMatchObject({
                hasSessionHint: true,
                isNetworkUsable: false,
                hasSavedUser: false,
            });
            expect(sessionAccess(readSession(), readSessionEnvironment())).toBe('offlineNoData');
        } finally {
            vi.useRealTimers();
        }
    });

    test('NET-008 online with a hint and no saved user the loader still waits for the check (up to 5 s)', async () => {
        vi.useFakeTimers();
        try {
            const refreshAuthTokens = vi.fn(() => new Promise<string>(() => undefined));
            useAuthStore.setState({
                status: 'unknown',
                unauthReason: undefined,
                refreshAuthTokens,
            });
            const decision = requireSession(loaderArgs('/dashboard'));
            let isDecided = false;
            void decision.then(() => {
                isDecided = true;
            });

            await vi.advanceTimersByTimeAsync(AUTH_READY_TIMEOUT_MS - 1);
            expect(isDecided).toBe(false);

            await vi.advanceTimersByTimeAsync(1);
            expect(isDecided).toBe(true);
            await expect(decision).resolves.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('NET-008 a saved user on the device: the environment has it, offline the cached page', () => {
        onlineManager.setOnline(false);
        LocalStorage.set(LS_KEY_USER, { id: 'user-1', role: 'USER', settings: SETTINGS });
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });

        expect(readSessionEnvironment().hasSavedUser).toBe(true);
        expect(sessionAccess(readSession(), readSessionEnvironment())).toBe('pass');
    });

    test('leaving the OAuth callback: the check runs for the URL being loaded', async () => {
        // A client navigation from the callback page: `window.location` is still the callback.
        window.history.replaceState(null, '', '/oauth/callback?code=x');
        const refreshAuthTokens = vi.fn(() => new Promise<string>(() => undefined));
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined, refreshAuthTokens });

        void requireSession(loaderArgs('/dashboard'));

        await vi.waitFor(() => {
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
        });
    });

    test('decides by the live session after the wait, not by what authReady saw', async () => {
        const refreshAuthTokens = vi.fn(() => new Promise<string>(() => undefined));
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined, refreshAuthTokens });
        const decision = requireSession(loaderArgs('/dashboard'));
        await vi.waitFor(() => {
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
        });

        // `authReady` resolves with the first answer; a remote logout follows before the loader
        // decides.
        useAuthStore.setState({ status: 'authenticated' });
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        expect((await decision)?.headers.get('Location')).toBe('/login?returnTo=%2Fdashboard');
    });
});
