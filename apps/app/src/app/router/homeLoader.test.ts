// Spec 04 §2.2 (04-5a): the `home` index redirects to the preferred mode; it replaces
// `PublicHomeGuard`.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_USER } from 'constants/localstorage';
import type { SelfUser } from 'entities/users';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { startCacheRestore } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { signInWithSelf } from 'test/selfUser';

import { homeLoader } from './homeLoader';

// Solo is unreleased (`IS_SOLO_MODE_RELEASED`): the access check is switched here per test.
const solo = vi.hoisted(() => ({ released: false }));

vi.mock('entities/users', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/users')>();

    return {
        ...actual,
        canRoleAccessSolo: (role: SelfUser['role'] | undefined) =>
            solo.released && role === 'ADMIN',
    };
});

const settings = (soloModeByDefault: boolean) =>
    ({
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    }) satisfies UserSettings;

const selfUser = (role: 'USER' | 'ADMIN', soloModeByDefault: boolean): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role,
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: settings(soloModeByDefault),
    createdAt: 1,
    updatedAt: 1,
});

const HOME_REQUEST = { request: new Request('http://localhost/') };

const locationOf = (response: Response) => response.headers.get('Location');

beforeAll(() => {
    startCacheRestore(undefined);
});

beforeEach(() => {
    solo.released = true;
    LocalStorage.remove(LS_KEY_USER);
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
});

afterEach(() => {
    LocalStorage.remove(LS_KEY_USER);
});

describe('homeLoader', () => {
    test('Solo by default with Solo access: to /solo', async () => {
        const client = signInWithSelf(selfUser('ADMIN', true));

        expect(locationOf(await homeLoader(client)(HOME_REQUEST))).toBe('/solo');
    });

    test('Solo by default without Solo access: to /dashboard', async () => {
        const client = signInWithSelf(selfUser('USER', true));

        expect(locationOf(await homeLoader(client)(HOME_REQUEST))).toBe('/dashboard');
    });

    test('the dashboard by default: to /dashboard', async () => {
        const client = signInWithSelf(selfUser('ADMIN', false));

        expect(locationOf(await homeLoader(client)(HOME_REQUEST))).toBe('/dashboard');
    });

    test('Solo unreleased: to /dashboard whatever the setting', async () => {
        solo.released = false;
        const client = signInWithSelf(selfUser('ADMIN', true));

        expect(locationOf(await homeLoader(client)(HOME_REQUEST))).toBe('/dashboard');
    });

    test('no cached profile: the cached LocalUser decides', async () => {
        saveLocalUser({ id: 'user-1', role: 'ADMIN', settings: settings(true) });

        expect(locationOf(await homeLoader(createTestQueryClient())(HOME_REQUEST))).toBe('/solo');
    });

    test('no cached user at all: to /dashboard', async () => {
        expect(locationOf(await homeLoader(createTestQueryClient())(HOME_REQUEST))).toBe(
            '/dashboard',
        );
    });

    test('AUTH-071: signed out, to /login with / as returnTo (as requireSession)', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

        expect(locationOf(await homeLoader(createTestQueryClient())(HOME_REQUEST))).toBe(
            '/login?returnTo=%2F',
        );
    });

    test('AUTH-077: an expired session derives no Solo access from the cached profile', async () => {
        const client = signInWithSelf(selfUser('ADMIN', true));
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

        expect(locationOf(await homeLoader(client)(HOME_REQUEST))).toBe('/dashboard');
    });
});
