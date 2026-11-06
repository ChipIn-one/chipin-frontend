import type { KnownUser } from 'api/chipin.types';
import { aggregateByCurrency, legacyBalanceFromFriend } from 'entities/balance';
import { getFilterFunction } from 'helpers/text';
import type { Money } from 'shared/money';

import type { FriendCurrencyGroup, FriendsView, UsersStore } from './types';

export const selectFriends = (s: UsersStore): KnownUser[] => s.friends;

type FriendEntry = FriendCurrencyGroup['friends'][number];

export const getFriendsView = (
    friends: KnownUser[],
    search: string,
    filterKey: string,
): FriendsView => {
    const filterFn = getFilterFunction(search);
    const currencies = new Set<string>();
    const entries: { item: FriendEntry; net: Money }[] = [];
    const settledFriends: KnownUser[] = [];

    for (const friend of friends) {
        if (filterFn && !filterFn([friend.user.displayName])) {
            continue;
        }

        if (friend.balances.length === 0) {
            if (filterKey === 'all') {
                settledFriends.push(friend);
            }

            continue;
        }

        for (const balance of friend.balances) {
            // An invalid legacy balance is skipped (and reported once) instead of crashing.
            const net = legacyBalanceFromFriend(balance)?.net;

            if (!net) {
                continue;
            }
            currencies.add(balance.currency);

            if (filterKey !== 'all' && balance.currency !== filterKey) {
                continue;
            }

            entries.push({ item: { friend, balance }, net });
        }
    }

    const currencyGroups = aggregateByCurrency(entries, entry => entry.net).map(
        ({ total, items }) => ({
            currency: total.currency,
            net: total,
            friends: items.map(entry => entry.item),
        }),
    );

    return {
        currencies: Array.from(currencies),
        currencyGroups,
        settledFriends,
    };
};
