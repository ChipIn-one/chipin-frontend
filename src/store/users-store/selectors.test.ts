import { expect, test } from 'vitest';

import type { KnownUser, UserRole, UserSettings } from 'api/chipin.types';
import { getOrThrow } from 'test/getOrThrow';

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
                net: { minor: 100_000n, currency: 'USD' },
                friends: [
                    {
                        friend: getOrThrow(friends, 0),
                        balance: getOrThrow(getOrThrow(friends, 0).balances, 0),
                    },
                ],
            },
            {
                currency: 'EUR',
                net: { minor: -20_000n, currency: 'EUR' },
                friends: [
                    {
                        friend: getOrThrow(friends, 0),
                        balance: getOrThrow(getOrThrow(friends, 0).balances, 1),
                    },
                ],
            },
        ],
        settledFriends: [friends[1]],
    });
});

test('normalizes float noise in friends currency group totals', () => {
    const createFriend = (id: string, balances: KnownUser['balances']): KnownUser => ({
        user: {
            id,
            email: `${id}@example.com`,
            displayName: id,
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
        createFriend('friend-1', [{ currency: 'USD', netAmount: 0.1 }]),
        createFriend('friend-2', [{ currency: 'USD', netAmount: 0.2 }]),
        createFriend('friend-3', [{ currency: 'USD', netAmount: -0.3 }]),
    ];

    expect(getOrThrow(getFriendsView(friends, '', 'all').currencyGroups, 0).net).toEqual({
        minor: 0n,
        currency: 'USD',
    });
});
