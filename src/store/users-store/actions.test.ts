import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser, UserSettings } from 'api/chipin.types';
import * as usersApi from 'api/usersApi';
import { usersKeys } from 'entities/users';
import { LocalStorage } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';
import { useLoadingStore } from 'store/loadingStore';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { useErrorsStore } from '../errorsStore';

import { useUsersStore } from './actions';

vi.mock('api/usersApi', () => ({
    fetchUser: vi.fn(),
}));

const settings = {
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
} satisfies UserSettings;

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: { ...settings, soloModeByDefault: false },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

beforeEach(() => {
    LocalStorage.clear();
    vi.clearAllMocks();
    useUsersStore.getState().setInitialUsersStore();
    useErrorsStore.getState().resetErrors();
    useLoadingStore.getState().setInitialLoadingStore();
});

// The signed-in user's QueryClient, registered as `clientFor` does it.
const mountUserClient = () => {
    const client = createTestQueryClient();

    cachesByUser.set(user.id, {
        client,
        ready: Promise.resolve(),
        isReady: true,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    });
    return client;
};

afterEach(() => {
    cachesByUser.delete(user.id);
});

test("seeds the user's users.self with the user it loads (the bridge)", async () => {
    const client = mountUserClient();

    vi.mocked(usersApi.fetchUser).mockResolvedValue(user);
    await useUsersStore.getState().fetchSetUser();
    expect(client.getQueryData(usersKeys.self())).toEqual(user);
});

test('returns the fetched user after updating the store', () => {
    vi.mocked(usersApi.fetchUser).mockResolvedValue(user);
    useUsersStore.setState({
        user: null,
        localUser: { role: user.role, settings: user.settings },
    });

    const fetchPromise = useUsersStore.getState().fetchSetUser();

    expect(fetchPromise).toBeInstanceOf(Promise);

    return Promise.resolve(fetchPromise).then(fetchedUser => {
        expect(fetchedUser).toEqual(user);
        expect(useUsersStore.getState().user).toEqual(user);
    });
});

test('records a confirmed user after success and retains it on failed refresh', async () => {
    vi.mocked(usersApi.fetchUser)
        .mockResolvedValueOnce(user)
        .mockRejectedValueOnce(new Error('User refresh unavailable'));

    expect(useUsersStore.getState().hasConfirmedUser).toBe(false);
    await useUsersStore.getState().fetchSetUser();
    expect(useUsersStore.getState()).toMatchObject({
        user,
        hasConfirmedUser: true,
    });

    await useUsersStore.getState().fetchSetUser(true);
    expect(useUsersStore.getState().hasConfirmedUser).toBe(true);
    useUsersStore.getState().setInitialUsersStore();
    expect(useUsersStore.getState().hasConfirmedUser).toBe(false);
});
