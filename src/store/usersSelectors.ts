import type {
    FriendBalance,
    KnownUser,
    ThemeName,
    User,
    UserSettings,
} from 'api/chipin.types';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import { getFilterFunction } from 'helpers/text';

import type { UsersStore } from './usersStore';

export const selectUserSettings = (s: UsersStore): UserSettings | null =>
    s.user?.settings ?? s.localUser?.settings ?? null;
export const selectUserCurrency = (s: UsersStore) =>
    selectUserSettings(s)?.defaultCurrency || DEFAULT_CURRENCY_CODE;
export const selectUserDisplayName = (s: UsersStore) => s.user?.displayName ?? '';
export const selectUserPreferredName = (
    user: Pick<User, 'displayName'> & Partial<Pick<User, 'firstName'>>,
) =>
    user.firstName || user.displayName;
export const selectIsUserTime24H = (s: UsersStore) =>
    selectUserSettings(s)?.timeFormat === '24h';
export const selectUserLanguage = (s: UsersStore) => selectUserSettings(s)?.language ?? 'en';
export const selectUserTheme = (s: UsersStore): ThemeName =>
    selectUserSettings(s)?.theme ?? 'system';
export const selectUserSimplifyDebts = (s: UsersStore) =>
    selectUserSettings(s)?.simplifyDebts ?? true;
export const selectFriends = (s: UsersStore): KnownUser[] => s.friends;
export const selectIsUserAdmin = (s: UsersStore) => (s.user?.role ?? s.localUser?.role) === 'ADMIN';

export interface FriendCurrencyGroup {
    currency: string;
    netBalance: number;
    friends: {
        friend: KnownUser;
        balance: FriendBalance;
    }[];
}

export const selectFriendsCurrencies = (
    friends: KnownUser[],
    search: string,
): string[] => {
    const filterFn = getFilterFunction(search);
    const filteredFriends = filterFn
        ? friends.filter(friend => filterFn([friend.user.displayName]))
        : friends;

    return Array.from(
        new Set(filteredFriends.flatMap(friend => friend.balances.map(balance => balance.currency))),
    );
};

export const selectFilteredCurrencyGroups = (
    friends: KnownUser[],
    search: string,
    filterKey: string,
): FriendCurrencyGroup[] => {
    const filterFn = getFilterFunction(search);
    const groups = new Map<string, FriendCurrencyGroup>();

    friends.forEach(friend => {
        if (filterFn && !filterFn([friend.user.displayName])) {
            return;
        }

        friend.balances.forEach(balance => {
            if (filterKey !== 'all' && balance.currency !== filterKey) {
                return;
            }

            const group = groups.get(balance.currency) ?? {
                currency: balance.currency,
                netBalance: 0,
                friends: [],
            };

            group.netBalance += balance.netAmount;
            group.friends.push({ friend, balance });
            groups.set(balance.currency, group);
        });
    });

    return Array.from(groups.values());
};

export const selectFilteredSettledFriends = (
    friends: KnownUser[],
    search: string,
    filterKey: string,
): KnownUser[] => {
    if (filterKey !== 'all') {
        return [];
    }

    const filterFn = getFilterFunction(search);
    const settled = friends.filter(friend => friend.balances.length === 0);

    if (!filterFn) {
        return settled;
    }

    return settled.filter(friend => filterFn([friend.user.displayName]));
};
