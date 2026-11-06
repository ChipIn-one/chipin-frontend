import { expect, test } from 'vitest';

import type { KnownUser } from 'api/chipin.types';
import { getOrThrow } from 'test/getOrThrow';

import { getFriendsView } from './selectors';

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

test('skips invalid legacy friend balances without throwing', () => {
    const friend = (balances: unknown): KnownUser =>
        // Bad runtime input the legacy DTO types do not admit (`JSON.parse` carries anything).
        ({
            user: {
                id: 'friend',
                email: 'friend@example.com',
                displayName: 'Friend',
                firstName: null,
                lastName: null,
                picture: null,
                createdAt: 1,
                updatedAt: 1,
            },
            balances,
            lastUsedCurrency: null,
        }) as unknown as KnownUser;
    const view = getFriendsView(
        [
            friend([
                { currency: 'USD', netAmount: 4 },
                { currency: '', netAmount: 1 },
                { currency: 'US', netAmount: 1 },
                { currency: 'EURO', netAmount: 1 },
                { currency: null, netAmount: 1 },
                { currency: 'EUR', netAmount: Number.NaN },
                { currency: 'EUR', netAmount: null },
            ]),
        ],
        '',
        'all',
    );

    expect(view.currencies).toEqual(['USD']);
    expect(view.currencyGroups.map(group => [group.currency, group.net.minor])).toEqual([
        ['USD', 40_000n],
    ]);
});
