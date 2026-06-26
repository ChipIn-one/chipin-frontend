import type { SettledFriend, UnsettledFriends } from 'api/chipin.types';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import { getFilterFunction } from 'helpers/text';

import type { UsersStore } from './usersStore';

export const selectUserCurrency = (s: UsersStore) =>
    s.user?.settings?.defaultCurrency || DEFAULT_CURRENCY_CODE;
export const selectUnSettledFriends = (s: UsersStore): UnsettledFriends[] => s.unSettledFriends;
export const selectSettledFriends = (s: UsersStore): SettledFriend[] => s.settledFriends;
export const selectIsUserAdmin = (s: UsersStore) => s.user?.role === 'ADMIN';

export const selectFriendsCurrencies = (
    unsettled: UnsettledFriends[],
    search: string,
): string[] => {
    const filterFn = getFilterFunction(search);

    if (!filterFn) {
        return unsettled.map(group => group.currency);
    }

    return unsettled
        .filter(unsettled => unsettled.friends.some(friend => filterFn([friend.user.displayName])))
        .map(unsettled => unsettled.currency);
};

export const selectFilteredCurrencyGroups = (
    groups: UnsettledFriends[],
    search: string,
    filterKey: string,
): UnsettledFriends[] => {
    const filterFn = getFilterFunction(search);

    return groups
        .filter(group => filterKey === 'all' || group.currency === filterKey)
        .map(group => {
            if (!filterFn) {
                return group;
            }

            return {
                ...group,
                friends: group.friends.filter(f => filterFn([f.user.displayName])),
            };
        })
        .filter(group => group.friends.length > 0);
};

export const selectFilteredSettledFriends = (
    settled: SettledFriend[],
    search: string,
    filterKey: string,
): SettledFriend[] => {
    if (filterKey !== 'all') {
        return [];
    }

    const filterFn = getFilterFunction(search);

    if (!filterFn) {
        return settled;
    }

    return settled.filter(friend => filterFn([friend.user.displayName]));
};
