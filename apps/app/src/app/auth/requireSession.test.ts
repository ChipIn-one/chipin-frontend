// Spec 04 §2.3, the `requireSession` table (04-2a2b; 04-2f: `SIGNED_OUT` and `MISSING` → `/login`).
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';
import { startCacheRestore } from 'shared/offline/restore';
import { UNAUTH_REASON, type UnauthReason } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { loginPathFor, requireSession, type SessionAccess, sessionAccess } from './requireSession';
import { type Session, UNKNOWN_OFFLINE } from './session';

vi.mock('shared/offline/clearUserData', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/offline/clearUserData')>()),
    clearUserData: vi.fn(() => Promise.resolve()),
}));

const loaderArgs = (path: string) => ({ request: new Request(`http://localhost${path}`) });

const unauth = (reason: UnauthReason): Session => ({ status: 'unauthenticated', reason });
const ENVIRONMENTS = [
    { hasSessionHint: true, isNetworkUsable: true },
    { hasSessionHint: true, isNetworkUsable: false },
    { hasSessionHint: false, isNetworkUsable: true },
    { hasSessionHint: false, isNetworkUsable: false },
] as const;

// Every row of the table, in every environment: [session, online access, hint+offline access].
const ROWS: [string, Session, SessionAccess, SessionAccess][] = [
    ['authenticated', { status: 'authenticated' }, 'pass', 'pass'],
    ['signed_out', unauth(UNAUTH_REASON.SIGNED_OUT), 'login', 'login'],
    ['missing', unauth(UNAUTH_REASON.MISSING), 'login', 'login'],
    ['expired', unauth(UNAUTH_REASON.EXPIRED), 'modalOverPage', 'modalOverPage'],
    ['invalid', unauth(UNAUTH_REASON.INVALID), 'modalOverPage', 'modalOverPage'],
    ['error', unauth(UNAUTH_REASON.ERROR), 'modal', 'pass'],
    ['persistence_error', unauth(UNAUTH_REASON.PERSISTENCE_ERROR), 'modal', 'pass'],
    [UNKNOWN_OFFLINE, { status: UNKNOWN_OFFLINE }, 'modal', 'pass'],
];

describe('sessionAccess', () => {
    test.each(ROWS)('%s', (_name, session, otherwise, hintOffline) => {
        ENVIRONMENTS.forEach(env => {
            const expected = env.hasSessionHint && !env.isNetworkUsable ? hintOffline : otherwise;

            expect({ env, access: sessionAccess(session, env) }).toEqual({
                env,
                access: expected,
            });
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
        '04-2f requireSession: %s on /dashboard redirects to /login?returnTo=%%2Fdashboard',
        async reason => {
            useAuthStore.setState({ status: 'unauthenticated', unauthReason: reason });

            const response = await requireSession(loaderArgs('/dashboard'));

            expect(response?.status).toBe(302);
            expect(response?.headers.get('Location')).toBe('/login?returnTo=%2Fdashboard');
            expect(clearUserData).not.toHaveBeenCalled();
        },
    );

    test('04-2f requireSession: returnTo keeps the path and the query of a join link', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        const response = await requireSession(loaderArgs('/group/join/tok-1?ref=x'));

        expect(response?.headers.get('Location')).toBe(
            `/login?returnTo=${encodeURIComponent('/group/join/tok-1?ref=x')}`,
        );
    });

    test('04-2f requireSession: loginPathFor encodes the whole returnTo', () => {
        expect(loginPathFor('/friends/join/a&b?c=d#e')).toBe(
            '/login?returnTo=%2Ffriends%2Fjoin%2Fa%26b%3Fc%3Dd%23e',
        );
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
