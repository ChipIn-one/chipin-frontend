import { beforeEach, expect, test, vi } from 'vitest';

import type { KnownUser, User, UserSettings } from 'api/chipin.types';
import * as usersApi from 'api/usersApi';
import { LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { useLoadingStore } from 'store/loadingStore';

import { useUsersStore } from './actions';

vi.mock('api/usersApi', () => ({
    fetchKnownUsers: vi.fn(),
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
    firstName: null,
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: { ...settings, soloModeByDefault: false },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

const friend = {
    user: {
        id: 'friend-1',
        email: 'friend@example.com',
        displayName: 'Friend',
        firstName: null,
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    balances: [],
} satisfies KnownUser;

beforeEach(() => {
    LocalStorage.clear();
    vi.clearAllMocks();
    useUsersStore.getState().setInitialUsersStore();
    useLoadingStore.getState().setInitialLoadingStore();
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

test('returns the friends fetch promise', () => {
    vi.mocked(usersApi.fetchKnownUsers).mockResolvedValue({ friends: [] });

    const fetchPromise = useUsersStore.getState().fetchSetFriends();

    expect(fetchPromise).toBeInstanceOf(Promise);

    return Promise.resolve(fetchPromise).then(() => {
        expect(useUsersStore.getState().friends).toEqual([]);
    });
});

test('updates and removes settled friend balances in one pass', () => {
    useUsersStore.setState({
        user,
        friends: [
            {
                ...friend,
                balances: [
                    { currency: 'USD', netAmount: -5 },
                    { currency: 'EUR', netAmount: 2 },
                ],
            },
        ],
    });

    useUsersStore.getState().setSettlementWithFriend({
        fromUserId: user.id,
        toUserId: friend.user.id,
        amount: 5,
        currency: 'USD',
    });

    expect(useUsersStore.getState().friends[0].balances).toEqual([
        { currency: 'EUR', netAmount: 2 },
    ]);
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

test('does not persist a settings update that the API rejects', () => {
    const error = new Error('save failed');

    vi.mocked(usersApi.updateUser).mockRejectedValue(error);
    useUsersStore.setState({ user, localUser: null });

    return useUsersStore.getState().setUserSettings({ settings: { theme: 'dark' } }).then(
        () => Promise.reject(new Error('Expected the settings update to reject')),
        reason => {
            expect(reason).toBe(error);
            expect(useUsersStore.getState().user).toEqual(user);
            expect(LocalStorage.getRaw(LS_KEY_USER)).toBeNull();
        },
    );
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

    return useUsersStore.getState().uploadUserAvatar({ file }).then(
        () => Promise.reject(new Error('Expected the avatar upload to reject')),
        reason => {
            expect(reason).toBe(error);
            expect(useUsersStore.getState().user).toEqual(user);
            expect(useLoadingStore.getState().users.avatar).toBe('fetched');
        },
    );
});
