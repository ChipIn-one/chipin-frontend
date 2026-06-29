import type { SettledFriend, ThemeName, UnsettledFriends, UserSettings } from 'api/chipin.types';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import { getFilterFunction } from 'helpers/text';

import type { UsersStore } from './usersStore';

export const selectUserSettings = (s: UsersStore): UserSettings | null =>
    s.user?.settings ?? s.localUser?.settings ?? null;
export const selectUserCurrency = (s: UsersStore) =>
    selectUserSettings(s)?.defaultCurrency || DEFAULT_CURRENCY_CODE;
export const selectUserDisplayName = (s: UsersStore) => s.user?.displayName ?? '';
export const selectUserTimeFormat = (s: UsersStore) => selectUserSettings(s)?.timeFormat ?? '12h';
export const selectUserLanguage = (s: UsersStore) => selectUserSettings(s)?.language ?? 'en';
export const selectUserTheme = (s: UsersStore): ThemeName =>
    selectUserSettings(s)?.theme ?? 'system';
export const selectUserSimplifyDebts = (s: UsersStore) =>
    selectUserSettings(s)?.simplifyDebts ?? true;
export const selectUnSettledFriends = (s: UsersStore): UnsettledFriends[] => s.unSettledFriends;
export const selectSettledFriends = (s: UsersStore): SettledFriend[] => s.settledFriends;
export const selectIsUserAdmin = (s: UsersStore) => (s.user?.role ?? s.localUser?.role) === 'ADMIN';

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
