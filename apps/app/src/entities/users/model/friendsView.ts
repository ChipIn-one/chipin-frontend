// The friends page view (spec 03 §4.4): friends grouped by the currency of their direct balance,
// each group with its exact total (`entities/balance` aggregation), plus the settled friends.
import { aggregateByCurrency, type Balance } from 'entities/balance';
import { getFilterFunction } from 'helpers/text';
import { isZero } from 'shared/money';

import type { KnownUser } from './types';

export interface FriendCurrencyGroup {
    readonly currency: string;
    /** The exact sum of the friends' balances in `currency`. */
    readonly net: Balance['net'];
    readonly friends: readonly { readonly friend: KnownUser; readonly balance: Balance }[];
}

export interface FriendsView {
    /** Every currency a matching friend has a balance in (the filter's options). */
    readonly currencies: string[];
    readonly currencyGroups: readonly FriendCurrencyGroup[];
    /** Matching friends with nothing outstanding; shown only without a currency filter. */
    readonly settledFriends: readonly KnownUser[];
}

type FriendEntry = FriendCurrencyGroup['friends'][number];

/** `filterKey`: `'all'` or a currency code; `search` matches the friend's display name. */
export const getFriendsView = (
    friends: readonly KnownUser[],
    search: string,
    filterKey: string,
): FriendsView => {
    const filterFn = getFilterFunction(search);
    const currencies = new Set<string>();
    const entries: FriendEntry[] = [];
    const settledFriends: KnownUser[] = [];

    for (const friend of friends) {
        if (filterFn && !filterFn([friend.user.displayName])) {
            continue;
        }
        // A friend whose only balances are unreadable is not settled: they stay out of both lists.
        if (friend.balances.length === 0) {
            if (filterKey === 'all' && !friend.hasUnreadableBalance) {
                settledFriends.push(friend);
            }
            continue;
        }

        for (const balance of friend.balances) {
            const { currency } = balance.net;

            currencies.add(currency);

            if (filterKey === 'all' || currency === filterKey) {
                entries.push({ friend, balance });
            }
        }
    }

    const currencyGroups = aggregateByCurrency(entries, entry => entry.balance.net).map(
        ({ total, items }) => ({ currency: total.currency, net: total, friends: items }),
    );

    return { currencies: Array.from(currencies), currencyGroups, settledFriends };
};

/** Whether the friend has a debt in either direction (removing them is refused then). */
export const hasOutstandingDebt = (friend: KnownUser): boolean =>
    friend.hasUnreadableBalance || friend.balances.some(balance => !isZero(balance.net));
