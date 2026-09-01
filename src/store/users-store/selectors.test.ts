import { expect, test } from 'vitest';

import type { KnownUser, UserRole, UserSettings } from 'api/chipin.types';

import { useUsersStore } from './actions';
import {
    getFriendsView,
    selectCanAccessSolo,
    selectUserDefaultCategory,
    selectUserSaveGroupExpensesToSolo,
    selectUserSex,
    selectUserSkipCategory,
    selectUserSoloModeByDefault,
} from './selectors';

const createState = (settings: UserSettings, role: UserRole = 'USER') => {
    useUsersStore.setState({
        user: {
            id: 'user-1',
            email: 'user@example.com',
            displayName: 'User',
            picture: null,
            role,
            subscriptionUntil: null,
            inviteToken: 'invite-token-user',
            settings,
            createdAt: 1,
            updatedAt: 1,
        },
        localUser: null,
        friends: [],
    });

    return useUsersStore.getState();
};

test.each([
    { role: 'USER' as const, expected: false },
    { role: 'ADMIN' as const, expected: false },
])('keeps Solo unavailable for the $role role', ({ role, expected }) => {
    const state = createState(
        {
            defaultCurrency: 'USD',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            defaultCategory: 'food',
            skipCategory: false,
            soloModeByDefault: true,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
        role,
    );

    expect(selectCanAccessSolo(state)).toBe(expected);
});

test('selects expense and profile preferences from user settings', () => {
    const state = createState({
        defaultCurrency: 'USD',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        defaultCategory: 'transport',
        skipCategory: true,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: false,
        sex: 'female',
    });

    expect(selectUserDefaultCategory(state)).toBe('transport');
    expect(selectUserSkipCategory(state)).toBe(true);
    expect(selectUserSoloModeByDefault(state)).toBe(true);
    expect(selectUserSaveGroupExpensesToSolo(state)).toBe(false);
    expect(selectUserSex(state)).toBe('female');
});

test('builds the friends page view in one coordinated derivation', () => {
    const createFriend = (
        id: string,
        displayName: string,
        balances: KnownUser['balances'],
    ): KnownUser => ({
        user: {
            id,
            email: `${id}@example.com`,
            displayName,
            firstName: null,
            lastName: null,
            picture: null,
            createdAt: 1,
            updatedAt: 1,
        },
        balances,
        lastUsedCurrency: null,
    });
    const friends = [
        createFriend('friend-1', 'Alex', [
            { currency: 'USD', netAmount: 10 },
            { currency: 'EUR', netAmount: -2 },
        ]),
        createFriend('friend-2', 'Alice', []),
        createFriend('friend-3', 'Bob', [{ currency: 'USD', netAmount: 4 }]),
    ];

    expect(getFriendsView(friends, 'al', 'all')).toEqual({
        currencies: ['USD', 'EUR'],
        currencyGroups: [
            {
                currency: 'USD',
                netBalance: 10,
                friends: [{ friend: friends[0], balance: friends[0].balances[0] }],
            },
            {
                currency: 'EUR',
                netBalance: -2,
                friends: [{ friend: friends[0], balance: friends[0].balances[1] }],
            },
        ],
        settledFriends: [friends[1]],
    });
});
