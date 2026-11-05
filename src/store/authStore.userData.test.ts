// Spec 03 §1.5, the "reason → what is deleted" table: one test per row. Only a sign-out (this tab
// or remote) and an account switch delete the user's data; any other reason deletes nothing in IDB.
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { LS_KEY_USER } from 'constants/localstorage';
import { getLocalUser, LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { outboxKeys, queryCacheKey } from 'shared/offline/constants';
import { fakeAccessToken } from 'test/fakeAccessToken';

import { useAuthStore } from './authStore';
import { useDashboardStore } from './dashboardStore';
import { useExpenseModalStore } from './expenseModalStore';
import { useGroupsStore } from './groupsStore';
import { useUsersStore } from './users-store';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({ exchangeApiGoogleOAuthCode: vi.fn() }));
// The real `getAccessTokenSubject`; no network for the session itself.
vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    establishAuthSession: vi.fn(),
    invalidateAuthSession: vi.fn(),
    startAuthLogout: vi.fn(() => Promise.resolve()),
}));

const USER_X = 'user-x';
const USER_Y = 'user-y';

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'ru',
    theme: 'dark',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies SelfUser['settings'];

const selfUser = (id: string): SelfUser => ({
    id,
    email: `${id}@example.com`,
    displayName: id,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: `invite-${id}`,
    settings,
    createdAt: 1,
    updatedAt: 1,
});

const userKeys = (userId: string): string[] => [queryCacheKey(userId), ...outboxKeys(userId)];

const storedKeys = (userId: string): Promise<string[]> =>
    Promise.all(userKeys(userId).map(key => get(key).then(value => ({ key, value })))).then(
        entries => entries.filter(entry => entry.value !== undefined).map(entry => entry.key),
    );

const settleIdb = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 30));

/** X is signed in on this device: a cached user, IDB keys, legacy store data and a draft. */
const signInX = async (): Promise<void> => {
    await Promise.all(userKeys(USER_X).map(key => set(key, 'x-data')));
    saveLocalUser({ id: USER_X, role: 'ADMIN', settings });
    useUsersStore.getState().setInitialUsersStore();
    // A legacy store with X's server data in memory.
    useUsersStore.setState({ user: selfUser(USER_X) });
    useExpenseModalStore.setState({
        description: 'x expense',
        groupId: 'x-group',
        ownerId: USER_X,
    });
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
};

const expectDraftReset = (): void => {
    expect(useExpenseModalStore.getState()).toMatchObject({
        description: '',
        groupId: '',
        ownerId: null,
    });
};

const expectDraftKept = (): void => {
    expect(useExpenseModalStore.getState()).toMatchObject({
        description: 'x expense',
        groupId: 'x-group',
        ownerId: USER_X,
    });
};

const mockSignedInFetches = (id: string): void => {
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();
    vi.spyOn(useUsersStore.getState(), 'fetchSetUser').mockImplementation(() => {
        // As the real action: `saveLocalUser(toLocalUser(user))`.
        const localUser = { id, role: 'USER' as const, settings };
        saveLocalUser(localUser);
        useUsersStore.setState({ user: selfUser(id), localUser });
        return Promise.resolve(selfUser(id));
    });
};

const signInWith = (id: string, code: string): Promise<void> => {
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: fakeAccessToken(id),
        is_new_user: false,
    });
    mockSignedInFetches(id);
    return useAuthStore.getState().exchangeGoogleOAuthCode(code);
};

beforeEach(() => {
    vi.restoreAllMocks();
    LocalStorage.remove(LS_KEY_USER);
    useExpenseModalStore.getState().reset();
});

afterEach(settleIdb);

describe('reason → what is deleted (spec 03 §1.5)', () => {
    test('signOut() in this tab: clearUserData, draft reset, LS_KEY_USER = { settings }', async () => {
        await signInX();

        await useAuthStore.getState().signOut();

        expect(await storedKeys(USER_X)).toEqual([]);
        expectDraftReset();
        expect(useUsersStore.getState().user).toBeNull();
        expect(getLocalUser()).toEqual({ settings });
        expect(useAuthStore.getState().unauthReason).toBe('signed_out');
    });

    test('remote logout (signed_out): clearUserData of the in-memory user, draft reset', async () => {
        await signInX();
        // The initiating tab has already left only `{ settings }` in the shared localStorage.
        saveLocalUser({ settings });

        useAuthStore.getState().setUnauthenticated('signed_out');
        await settleIdb();

        expect(await storedKeys(USER_X)).toEqual([]);
        expectDraftReset();
        expect(useUsersStore.getState().user).toBeNull();
        expect(getLocalUser()).toEqual({ settings });
    });

    test.each([
        ['expireSession()', () => useAuthStore.getState().expireSession()],
        [
            'logoutOtherDevices 401 (expired)',
            () => useAuthStore.getState().setUnauthenticated('expired'),
        ],
    ])('%s: cache, outbox and draft kept, only the role dropped', async (_name, expire) => {
        await signInX();

        expire();
        await settleIdb();

        expect(await storedKeys(USER_X)).toEqual(userKeys(USER_X));
        expectDraftKept();
        // Legacy stores are reset and reloaded after sign-in.
        expect(useUsersStore.getState().user).toBeNull();
        expect(getLocalUser()).toEqual({ id: USER_X, settings });
    });

    test('invalid: cache, outbox and draft kept, only the role dropped', async () => {
        await signInX();

        useAuthStore.getState().setUnauthenticated('invalid');
        await settleIdb();

        expect(await storedKeys(USER_X)).toEqual(userKeys(USER_X));
        expectDraftKept();
        expect(getLocalUser()).toEqual({ id: USER_X, settings });
    });

    test('missing (cold start without a hint): nothing deleted, LS_KEY_USER unchanged', async () => {
        await signInX();

        useAuthStore.getState().setUnauthenticated('missing');
        await settleIdb();

        expect(await storedKeys(USER_X)).toEqual(userKeys(USER_X));
        expectDraftKept();
        expect(getLocalUser()).toEqual({ id: USER_X, role: 'ADMIN', settings });
    });

    test.each(['error', 'persistence_error'] as const)(
        '%s: nothing deleted, LS_KEY_USER unchanged',
        async reason => {
            await signInX();

            useAuthStore.getState().setUnauthenticated(reason);
            await settleIdb();

            expect(await storedKeys(USER_X)).toEqual(userKeys(USER_X));
            expectDraftKept();
            expect(getLocalUser()).toEqual({ id: USER_X, role: 'ADMIN', settings });
        },
    );

    test('sign-in of Y when LocalUser.id === X: clearUserData(X), draft reset, { id: Y, settings }', async () => {
        await signInX();
        useAuthStore.getState().expireSession();

        await signInWith(USER_Y, 'switch-code');

        // No X data in any store, in the draft, or in IDB (C1-02).
        expect(await storedKeys(USER_X)).toEqual([]);
        expectDraftReset();
        expect(useUsersStore.getState().user?.id).toBe(USER_Y);
        expect(getLocalUser()).toEqual({ id: USER_Y, role: 'USER', settings });
        expect(useAuthStore.getState().status).toBe('authenticated');
    });
});

describe('the session continues for the same user', () => {
    test('expire X → sign-in X: the draft and the stored data are in place', async () => {
        await signInX();
        useAuthStore.getState().expireSession();

        await signInWith(USER_X, 'same-user-code');

        expect(await storedKeys(USER_X)).toEqual(userKeys(USER_X));
        expectDraftKept();
    });

    test('a draft of another user is reset on sign-in even without a cached id', async () => {
        saveLocalUser({ settings });
        useUsersStore.getState().setInitialUsersStore();
        useExpenseModalStore.setState({ description: 'x expense', ownerId: USER_X });

        await signInWith(USER_Y, 'draft-owner-code');

        expect(useExpenseModalStore.getState()).toMatchObject({ description: '', ownerId: null });
    });
});
