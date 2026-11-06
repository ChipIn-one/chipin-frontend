import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser, UserSettings } from 'api/chipin.types';
import * as usersApi from 'api/usersApi';
import { LS_KEY_USER } from 'constants/localstorage';
import { usersKeys } from 'entities/users';
import { LocalStorage } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';
import { useLoadingStore } from 'store/loadingStore';
import { createKnownUser } from 'test/knownUsers';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { useErrorsStore } from '../errorsStore';

import { useUsersStore } from './actions';

vi.mock('api/usersApi', () => ({
    acceptKnownUserInvite: vi.fn(),
    fetchUser: vi.fn(),
    removeKnownUser: vi.fn(),
    updateUser: vi.fn(),
    uploadUserAvatar: vi.fn(),
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

test("seeds the user's users.self with every user it loads or saves (the bridge)", async () => {
    const client = mountUserClient();
    const renamed = { ...user, displayName: 'Renamed' };
    const withAvatar = { ...user, picture: 'https://example.com/a.png' };

    vi.mocked(usersApi.fetchUser).mockResolvedValue(user);
    await useUsersStore.getState().fetchSetUser();
    expect(client.getQueryData(usersKeys.self())).toEqual(user);

    vi.mocked(usersApi.updateUser).mockResolvedValue(renamed);
    await useUsersStore.getState().setUserSettings({ displayName: 'Renamed' });
    expect(client.getQueryData(usersKeys.self())).toEqual(renamed);

    vi.mocked(usersApi.uploadUserAvatar).mockResolvedValue(withAvatar);
    await useUsersStore.getState().uploadUserAvatar({ file: new File([], 'a.png') });
    expect(client.getQueryData(usersKeys.self())).toEqual(withAvatar);
});

test('a failed settings update leaves users.self as it was', async () => {
    const client = mountUserClient();

    vi.mocked(usersApi.fetchUser).mockResolvedValue(user);
    await useUsersStore.getState().fetchSetUser();
    vi.mocked(usersApi.updateUser).mockRejectedValue(new Error('Update failed'));
    await useUsersStore.getState().setUserSettings({ displayName: 'Renamed' });

    expect(client.getQueryData(usersKeys.self())).toEqual(user);
});

test('extends the subscription of the user the UI shows by one day', async () => {
    const client = mountUserClient();

    vi.mocked(usersApi.fetchUser).mockResolvedValue({ ...user, subscriptionUntil: 1_000 });
    await useUsersStore.getState().fetchSetUser();
    useUsersStore.getState().extendUserSubscriptionByDay();

    expect(client.getQueryData(usersKeys.self())).toMatchObject({
        subscriptionUntil: 1_000 + 86_400,
    });
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

const invite = {
    id: 'friend-1',
    email: 'friend@example.com',
    displayName: 'Friend',
    createdAt: 1,
    updatedAt: 1,
};

// The user's client with cached friends, whose `users.known` the bridge marks stale.
const mountClientWithFriends = () => {
    const client = mountUserClient();

    useUsersStore.setState({ localUser: { id: user.id, role: user.role, settings } });
    client.setQueryData(usersKeys.known(), [createKnownUser('friend-0')]);
    return client;
};

test('accepts a friend invite and marks the known users stale (the bridge)', async () => {
    const client = mountClientWithFriends();
    vi.mocked(usersApi.acceptKnownUserInvite).mockResolvedValue(invite);

    const result = await useUsersStore
        .getState()
        .acceptFriendInvite({ inviteToken: 'friend-token' });

    expect(usersApi.acceptKnownUserInvite).toHaveBeenCalledWith({ inviteToken: 'friend-token' });
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
    expect(result).toEqual(invite);
});

test('accepts a friend invite before the user has a client (first sign-in)', async () => {
    vi.mocked(usersApi.acceptKnownUserInvite).mockResolvedValue(invite);

    await expect(
        useUsersStore.getState().acceptFriendInvite({ inviteToken: 'friend-token' }),
    ).resolves.toEqual(invite);
});

test('a failed invite leaves the known users as they were', async () => {
    const client = mountClientWithFriends();
    vi.mocked(usersApi.acceptKnownUserInvite).mockRejectedValue(new Error('Invite failed'));

    await expect(
        useUsersStore.getState().acceptFriendInvite({ inviteToken: 'friend-token' }),
    ).rejects.toThrow('Invite failed');
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(false);
});

test('returns the user settings update promise', () => {
    const updatedUser = { ...user, displayName: 'Updated User' };

    vi.mocked(usersApi.updateUser).mockResolvedValue(updatedUser);
    useUsersStore.setState({ user, localUser: null });

    const updatePromise = useUsersStore.getState().setUserSettings({
        displayName: updatedUser.displayName,
    });

    expect(updatePromise).toBeInstanceOf(Promise);

    return Promise.resolve(updatePromise).then(() => {
        expect(useUsersStore.getState().user).toEqual(updatedUser);
    });
});

test('includes an empty display name in the update request', () => {
    const updatedUser = { ...user, displayName: '' };

    vi.mocked(usersApi.updateUser).mockResolvedValue(updatedUser);
    useUsersStore.setState({ user, localUser: null });

    return useUsersStore
        .getState()
        .setUserSettings({ displayName: '' })
        .then(() => {
            expect(usersApi.updateUser).toHaveBeenCalledWith({ displayName: '' });
            expect(useUsersStore.getState().user?.displayName).toBe('');
        });
});

test('sends only changed settings fields and replaces state with the response', () => {
    const updatedUser = {
        ...user,
        settings: { ...user.settings, theme: 'dark' as const },
    };
    vi.mocked(usersApi.updateUser).mockResolvedValue(updatedUser);
    useUsersStore.setState({ user, localUser: null });

    return useUsersStore
        .getState()
        .setUserSettings({ settings: { theme: 'dark' } })
        .then(() => {
            expect(usersApi.updateUser).toHaveBeenCalledWith({ settings: { theme: 'dark' } });
            expect(useUsersStore.getState().user).toEqual(updatedUser);
        });
});

test('records a settings error without replacing the current user', () => {
    const error = new Error('save failed');

    vi.mocked(usersApi.updateUser).mockRejectedValue(error);
    useUsersStore.setState({ user, localUser: null });

    return useUsersStore
        .getState()
        .setUserSettings({ settings: { theme: 'dark' } })
        .then(() => {
            expect(useErrorsStore.getState().errors.users.settings).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
            expect(useUsersStore.getState().user).toEqual(user);
            expect(LocalStorage.getRaw(LS_KEY_USER)).toBeNull();
        });
});

test('serializes settings updates so an older response cannot overwrite a newer one', () => {
    let resolveFirst: ((value: SelfUser) => void) | undefined;
    const firstResponse = {
        ...user,
        settings: { ...user.settings, theme: 'dark' as const },
    };
    const secondResponse = {
        ...firstResponse,
        settings: { ...firstResponse.settings, language: 'ru' },
    };
    vi.mocked(usersApi.updateUser)
        .mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve;
                }),
        )
        .mockResolvedValueOnce(secondResponse);
    useUsersStore.setState({ user, localUser: null });

    const firstUpdate = useUsersStore.getState().setUserSettings({
        settings: { theme: 'dark' },
    });
    const secondUpdate = useUsersStore.getState().setUserSettings({
        settings: { language: 'ru' },
    });

    return Promise.resolve()
        .then(() => {
            expect(usersApi.updateUser).toHaveBeenCalledTimes(1);
            resolveFirst?.(firstResponse);
            return firstUpdate;
        })
        .then(() => secondUpdate)
        .then(() => {
            expect(usersApi.updateUser).toHaveBeenCalledTimes(2);
            expect(useUsersStore.getState().user).toEqual(secondResponse);
        });
});

test('does not keep an older settings error after a newer update succeeds', () => {
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    const secondResponse = {
        ...user,
        settings: { ...user.settings, language: 'ru' },
    };
    vi.mocked(usersApi.updateUser)
        .mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectFirst = reject;
                }),
        )
        .mockResolvedValueOnce(secondResponse);
    useUsersStore.setState({ user, localUser: null });

    const firstUpdate = useUsersStore.getState().setUserSettings({
        settings: { theme: 'dark' },
    });
    const secondUpdate = useUsersStore.getState().setUserSettings({
        settings: { language: 'ru' },
    });

    return Promise.resolve()
        .then(() => {
            rejectFirst?.(new Error('older update failed'));
            return firstUpdate;
        })
        .then(() => secondUpdate)
        .then(() => {
            expect(useUsersStore.getState().user).toEqual(secondResponse);
            expect(useErrorsStore.getState().errors.users.settings).toBeNull();
        });
});

test('does not restore profile state when a settings response arrives after reset', () => {
    let resolveUpdate: ((value: SelfUser) => void) | undefined;
    vi.mocked(usersApi.updateUser).mockImplementation(
        () =>
            new Promise(resolve => {
                resolveUpdate = resolve;
            }),
    );
    useUsersStore.setState({ user, localUser: null });

    const update = useUsersStore.getState().setUserSettings({
        settings: { theme: 'dark' },
    });

    return Promise.resolve()
        .then(() => {
            useUsersStore.getState().setInitialUsersStore();
            resolveUpdate?.({
                ...user,
                settings: { ...user.settings, theme: 'dark' },
            });
            return update;
        })
        .then(() => {
            expect(useUsersStore.getState().user).toBeNull();
            expect(LocalStorage.getRaw(LS_KEY_USER)).toBeNull();
        });
});

test('ignores a settings rejection that arrives after reset', () => {
    let rejectUpdate: ((reason?: unknown) => void) | undefined;
    vi.mocked(usersApi.updateUser).mockImplementation(
        () =>
            new Promise((_resolve, reject) => {
                rejectUpdate = reject;
            }),
    );
    useUsersStore.setState({ user, localUser: null });

    const update = useUsersStore.getState().setUserSettings({
        settings: { theme: 'dark' },
    });

    return Promise.resolve()
        .then(() => {
            useUsersStore.getState().setInitialUsersStore();
            rejectUpdate?.(new Error('stale update failed'));
            return update;
        })
        .then(() => {
            expect(useErrorsStore.getState().errors.users.settings).toBeNull();
        });
});

test('uploads an avatar and replaces the current user with the response', () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const updatedUser = { ...user, picture: 'https://cdn.example.com/avatar.png' };
    const onProgress = vi.fn();

    vi.mocked(usersApi.uploadUserAvatar).mockImplementation(params => {
        params.onProgress?.(60);
        return Promise.resolve(updatedUser);
    });
    useUsersStore.setState({ user, localUser: null });

    const uploadPromise = useUsersStore.getState().uploadUserAvatar({ file, onProgress });

    expect(uploadPromise).toBeInstanceOf(Promise);
    expect(useLoadingStore.getState().users.avatar).toBe('loading');

    return uploadPromise.then(result => {
        expect(result).toEqual(updatedUser);
        expect(onProgress).toHaveBeenCalledWith(60);
        expect(useUsersStore.getState().user).toEqual(updatedUser);
        expect(useLoadingStore.getState().users.avatar).toBe('fetched');
        expect(LocalStorage.get(LS_KEY_USER, { role: 'USER', settings })).toEqual({
            id: updatedUser.id,
            role: updatedUser.role,
            settings: updatedUser.settings,
        });
    });
});

test('keeps the current user when an avatar upload fails', () => {
    const error = new Error('upload failed');
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    vi.mocked(usersApi.uploadUserAvatar).mockRejectedValue(error);
    useUsersStore.setState({ user, localUser: null });

    return useUsersStore
        .getState()
        .uploadUserAvatar({ file })
        .then(
            () => Promise.reject(new Error('Expected the avatar upload to reject')),
            reason => {
                expect(reason).toBe(error);
                expect(useUsersStore.getState().user).toEqual(user);
                expect(useLoadingStore.getState().users.avatar).toBe('fetched');
            },
        );
});

test('does not restore profile state when an avatar response arrives after reset', () => {
    let resolveUpload: ((value: SelfUser) => void) | undefined;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    vi.mocked(usersApi.uploadUserAvatar).mockImplementation(
        () =>
            new Promise(resolve => {
                resolveUpload = resolve;
            }),
    );
    useUsersStore.setState({ user, localUser: null });

    const upload = useUsersStore.getState().uploadUserAvatar({ file });

    return Promise.resolve()
        .then(() => {
            useUsersStore.getState().setInitialUsersStore();
            resolveUpload?.({ ...user, picture: 'https://cdn.example.com/stale.png' });
            return upload;
        })
        .then(
            () => Promise.reject(new Error('Expected the stale upload to reject')),
            () => {
                expect(useUsersStore.getState().user).toBeNull();
                expect(LocalStorage.getRaw(LS_KEY_USER)).toBeNull();
            },
        );
});

test('ignores an avatar rejection that arrives after reset', () => {
    let rejectUpload: ((reason?: unknown) => void) | undefined;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    vi.mocked(usersApi.uploadUserAvatar).mockImplementation(
        () =>
            new Promise((_resolve, reject) => {
                rejectUpload = reject;
            }),
    );
    useUsersStore.setState({ user, localUser: null });

    const upload = useUsersStore.getState().uploadUserAvatar({ file });

    return Promise.resolve()
        .then(() => {
            useUsersStore.getState().setInitialUsersStore();
            rejectUpload?.(new Error('stale upload failed'));
            return upload;
        })
        .then(
            () => Promise.reject(new Error('Expected the stale upload to reject')),
            () => {
                expect(useErrorsStore.getState().errors.users.avatar).toBeNull();
            },
        );
});

test('removes a friend and marks the known users stale (the bridge)', async () => {
    const client = mountClientWithFriends();
    vi.mocked(usersApi.removeKnownUser).mockResolvedValue(undefined);

    await expect(
        useUsersStore.getState().removeFriend({ userId: 'friend-1' }),
    ).resolves.toBeUndefined();

    expect(usersApi.removeKnownUser).toHaveBeenCalledWith({ userId: 'friend-1' });
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
    expect(useLoadingStore.getState().users.removeFriend).toBe('fetched');
});

test('rejects a failed friend removal without marking the known users stale', () => {
    const client = mountClientWithFriends();
    const mutationError = new Error('Removal failed');
    vi.mocked(usersApi.removeKnownUser).mockRejectedValue(mutationError);

    return expect(useUsersStore.getState().removeFriend({ userId: 'friend-1' }))
        .rejects.toBe(mutationError)
        .then(() => {
            expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(false);
            expect(useErrorsStore.getState().errors.users.removeFriend).toEqual(
                expect.objectContaining({ message: expect.any(String) }),
            );
        });
});
