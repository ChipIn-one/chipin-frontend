import type {
    KnownUser,
    ThemeName,
    UserSettings,
} from 'api/chipin.types';
import { DEFAULT_EXPENSE_CATEGORY } from 'constants/chipin';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import { getFilterFunction } from 'helpers/text';

import type { FriendCurrencyGroup, FriendsView, UsersStore } from './types';

export const selectUserSettings = (s: UsersStore): UserSettings | null =>
    s.user?.settings ?? s.localUser?.settings ?? null;
export const selectUserCurrency = (s: UsersStore) =>
    selectUserSettings(s)?.defaultCurrency || DEFAULT_CURRENCY_CODE;
export const selectUserDisplayName = (s: UsersStore) => s.user?.displayName ?? '';
export const selectIsUserTime24H = (s: UsersStore) =>
    selectUserSettings(s)?.timeFormat === '24h';
export const selectUserLanguage = (s: UsersStore) => selectUserSettings(s)?.language ?? 'en';
export const selectUserTheme = (s: UsersStore): ThemeName =>
    selectUserSettings(s)?.theme ?? 'system';
export const selectUserSimplifyDebts = (s: UsersStore) =>
    selectUserSettings(s)?.simplifyDebts ?? true;
export const selectUserDefaultCategory = (s: UsersStore) =>
    selectUserSettings(s)?.defaultCategory ?? DEFAULT_EXPENSE_CATEGORY;
export const selectUserSkipCategory = (s: UsersStore) =>
    selectUserSettings(s)?.skipCategory ?? false;
export const selectUserSoloModeByDefault = (s: UsersStore) =>
    selectUserSettings(s)?.soloModeByDefault ?? false;
export const selectUserSaveGroupExpensesToSolo = (s: UsersStore) =>
    selectUserSettings(s)?.saveGroupExpensesToSolo ?? false;
export const selectUserSex = (s: UsersStore) =>
    selectUserSettings(s)?.sex ?? 'male';
export const selectFriends = (s: UsersStore): KnownUser[] => s.friends;
export const selectIsUserAdmin = (s: UsersStore) => (s.user?.role ?? s.localUser?.role) === 'ADMIN';

export const getFriendsView = (
    friends: KnownUser[],
    search: string,
    filterKey: string,
): FriendsView => {
    const filterFn = getFilterFunction(search);
    const currencies = new Set<string>();
    const groups = new Map<string, FriendCurrencyGroup>();
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
            currencies.add(balance.currency);

            if (filterKey !== 'all' && balance.currency !== filterKey) {
                continue;
            }

            const group = groups.get(balance.currency) ?? {
                currency: balance.currency,
                netBalance: 0,
                friends: [],
            };

            group.netBalance += balance.netAmount;
            group.friends.push({ friend, balance });
            groups.set(balance.currency, group);
        }
    }

    return {
        currencies: Array.from(currencies),
        currencyGroups: Array.from(groups.values()),
        settledFriends,
    };
};
