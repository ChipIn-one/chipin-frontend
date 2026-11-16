import { expect, test } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { getOrThrow } from 'test/getOrThrow';
import { createKnownUser } from 'test/knownUsers';

import { getFriendsView, hasOutstandingDebt } from './friendsView';

const named = (
    id: string,
    displayName: string,
    balances: Parameters<typeof createKnownUser>[1],
) => {
    const friend = createKnownUser(id, balances);

    return { ...friend, user: { ...friend.user, displayName } };
};

test('builds the friends page view: groups by currency with exact totals, then settled', () => {
    const friends = [
        named('friend-1', 'Alex', [
            ['USD', 100_000n],
            ['EUR', -20_000n],
        ]),
        named('friend-2', 'Alice', []),
        named('friend-3', 'Bob', [['USD', 40_000n]]),
    ];
    const alex = getOrThrow(friends, 0);

    expect(getFriendsView(friends, 'al', 'all')).toEqual({
        currencies: ['USD', 'EUR'],
        currencyGroups: [
            {
                currency: 'USD',
                net: fromUnits(100_000n, currencyCode('USD')),
                friends: [{ friend: alex, balance: getOrThrow(alex.balances, 0) }],
            },
            {
                currency: 'EUR',
                net: fromUnits(-20_000n, currencyCode('EUR')),
                friends: [{ friend: alex, balance: getOrThrow(alex.balances, 1) }],
            },
        ],
        settledFriends: [friends[1]],
    });
});

test('sums a currency group exactly, beyond 2^39 and to zero', () => {
    const friends = [
        createKnownUser('friend-1', [['USD', 8_999_999_999_999_997n]]),
        createKnownUser('friend-2', [['USD', 3n]]),
        createKnownUser('friend-3', [['EUR', 1_000n]]),
        createKnownUser('friend-4', [['EUR', -1_000n]]),
    ];

    const groups = getFriendsView(friends, '', 'all').currencyGroups;

    expect(groups.map(group => group.net)).toEqual([
        fromUnits(9_000_000_000_000_000n, currencyCode('USD')),
        fromUnits(0n, currencyCode('EUR')),
    ]);
});

test('a currency filter keeps every currency option but only that currency and no settled list', () => {
    const friends = [
        createKnownUser('friend-1', [
            ['USD', 10_000n],
            ['EUR', 20_000n],
        ]),
        createKnownUser('friend-2', []),
    ];

    const view = getFriendsView(friends, '', 'EUR');

    expect(view.currencies).toEqual(['USD', 'EUR']);
    expect(view.currencyGroups.map(group => group.currency)).toEqual(['EUR']);
    expect(view.settledFriends).toEqual([]);
});

test('a friend whose only balances are unreadable is neither settled nor grouped', () => {
    const unreadable = createKnownUser('friend-1', [], { hasUnreadableBalance: true });

    expect(getFriendsView([unreadable], '', 'all')).toEqual({
        currencies: [],
        currencyGroups: [],
        settledFriends: [],
    });
});

test('removing a friend needs every balance settled and readable', () => {
    expect(hasOutstandingDebt(createKnownUser('a', []))).toBe(false);
    expect(hasOutstandingDebt(createKnownUser('b', [['USD', 0n]]))).toBe(false);
    // 0.0040 USD is a debt (spec 03 §4.2 `displaySign`).
    expect(hasOutstandingDebt(createKnownUser('c', [['USD', 40n]]))).toBe(true);
    expect(hasOutstandingDebt(createKnownUser('d', [['USD', -1n]]))).toBe(true);
    expect(hasOutstandingDebt(createKnownUser('e', [], { hasUnreadableBalance: true }))).toBe(true);
});
