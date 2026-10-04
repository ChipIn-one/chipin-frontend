import type { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import type { Group, GroupUser } from 'api/chipin.types';
import {
    GROUP_CARD_FILTER_BUCKETS,
    GROUP_DEBT_FILTERS,
    GROUP_NET_CONVERSION_STATES,
    GROUP_SETTLED_AUTO_HIDE_SECONDS,
    type GroupCardFilterBucket,
    type GroupDebtFilter,
    type GroupNetConversionState,
} from 'constants/groups';
import {
    convertCurrencyAmount,
    getBalanceEntriesSummary,
    sortBalancesByCurrency,
} from 'helpers/currencies';
import {
    normalizeApiMoneyAmount,
    normalizeFloatingPointZero,
} from 'helpers/numbers';

import type { GroupsStore } from './groupsStore';

export const selectGroups = (s: GroupsStore) => s.groups;
export const selectSelectedGroup = (s: GroupsStore) => s.selectedGroup;

export interface GroupSettlementOption {
    user: GroupUser;
    balances: BalanceEntry[];
}

export interface GroupSettlementOptions {
    youOwe: GroupSettlementOption[];
    owedToYou: GroupSettlementOption[];
}

export const selectGroupSettlementOptions = (
    group: Group,
    currentUserId: string,
): GroupSettlementOptions => {
    const settlementOptions: GroupSettlementOptions = { youOwe: [], owedToYou: [] };

    group.members.forEach(member => {
        if (member.user.id === currentUserId) {
            return;
        }

        const balancesYouOwe: BalanceEntry[] = [];
        const balancesOwedToYou: BalanceEntry[] = [];

        Object.values(member.balancesByCurrency).forEach(balance => {
            if (balance.netBalance < 0) {
                balancesYouOwe.push(balance);
            }

            if (balance.netBalance > 0) {
                balancesOwedToYou.push(balance);
            }
        });

        if (balancesYouOwe.length > 0) {
            settlementOptions.youOwe.push({
                user: member.user,
                balances: balancesYouOwe,
            });
        }

        if (balancesOwedToYou.length > 0) {
            settlementOptions.owedToYou.push({
                user: member.user,
                balances: balancesOwedToYou,
            });
        }
    });

    return settlementOptions;
};

export interface GroupBalances {
    owedEntries: BalanceEntry[];
    oweEntries: BalanceEntry[];
}

export const selectGroupBalances = (group: Group): GroupBalances => {
    const balancesByDirection = group.members.reduce<{
        owed: BalancesMap;
        owing: BalancesMap;
    }>((groupBalances, member) => {
        Object.values(member.balancesByCurrency).forEach(balance => {
            if (balance.netBalance === 0) {
                return;
            }

            const direction = balance.netBalance > 0 ? groupBalances.owed : groupBalances.owing;
            const existingBalance = direction[balance.currency];
            direction[balance.currency] = {
                currency: balance.currency,
                netBalance: (existingBalance?.netBalance ?? 0) + balance.netBalance,
            };
        });

        return groupBalances;
    }, { owed: {}, owing: {} });

    return {
        owedEntries: Object.values(balancesByDirection.owed),
        oweEntries: Object.values(balancesByDirection.owing),
    };
};

export const sortGroupBalances = (
    balances: GroupBalances,
    rates: CurrenciesRates,
    baseCurrency: string,
): BalanceEntry[] => {
    const { owedEntries, oweEntries } = balances;

    return sortBalancesByCurrency(
        [...owedEntries, ...oweEntries],
        rates,
        baseCurrency,
        baseCurrency,
    );
};

export const calcGroupSummary = (
    balances: GroupBalances,
    base: string,
    rates: CurrenciesRates,
    defaultCurrency = base,
) => {
    const { owedEntries, oweEntries } = balances;
    const { netTotalInBase, owedTotalInBase, owingTotalInBase } = getBalanceEntriesSummary(
        [...owedEntries, ...oweEntries],
        rates,
        base,
        defaultCurrency,
    );

    return {
        oweEntries: sortBalancesByCurrency(
            oweEntries,
            rates,
            base,
            defaultCurrency,
        ),
        owedEntries: sortBalancesByCurrency(
            owedEntries,
            rates,
            base,
            defaultCurrency,
        ),
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
    };
};

export interface GroupCardViewModel {
    group: Group;
    isSettled: boolean;
    activeCurrencyCount: number;
    sourceCurrencyBalance: BalanceEntry | null;
    netAmount: number | null;
    netCurrency: string;
    conversionState: GroupNetConversionState;
    filterBucket: GroupCardFilterBucket;
    latestActivityAt: number;
    isAutoHidden: boolean;
}

interface GroupCardViewOptions {
    rates: CurrenciesRates;
    baseCurrency: string;
    defaultCurrency: string;
    nowTimestamp: number;
}

interface GroupsCardsViewOptions extends GroupCardViewOptions {
    filter: GroupDebtFilter;
    query: string;
    selectedGroupId?: Group['id'];
}

export interface GroupsCardsView {
    displayedGroups: GroupCardViewModel[];
    hiddenSettledGroups: GroupCardViewModel[];
    settledCount: number;
}

const getLatestGroupActivityAt = (group: Group): number => {
    let latestActivityAt = group.createdAt;

    for (const item of group.recentActivities.items) {
        if (item.lastEvent.createdAt > latestActivityAt) {
            latestActivityAt = item.lastEvent.createdAt;
        }
    }

    return latestActivityAt;
};

export const selectGroupCardViewModel = (
    group: Group,
    { rates, baseCurrency, defaultCurrency, nowTimestamp }: GroupCardViewOptions,
): GroupCardViewModel => {
    const balancesByCurrency = new Map<string, number>();

    for (const member of group.members) {
        for (const balance of Object.values(member.balancesByCurrency)) {
            if (balance.netBalance === 0) {
                continue;
            }

            balancesByCurrency.set(
                balance.currency,
                (balancesByCurrency.get(balance.currency) ?? 0) + balance.netBalance,
            );
        }
    }

    const isSettled = balancesByCurrency.size === 0;
    const activeCurrencyCount = balancesByCurrency.size;
    let sourceCurrencyBalance: BalanceEntry | null = null;
    let netAmount = 0;
    let netMagnitude = 0;
    let conversionState: GroupNetConversionState = GROUP_NET_CONVERSION_STATES.SAME_CURRENCY;

    for (const [currency, accumulatedAmount] of balancesByCurrency) {
        const amount = normalizeApiMoneyAmount(accumulatedAmount);

        if (activeCurrencyCount === 1) {
            sourceCurrencyBalance = {
                currency,
                netBalance: amount,
            };
        }

        if (amount === 0) {
            continue;
        }

        if (currency === defaultCurrency) {
            netAmount += amount;
            netMagnitude += Math.abs(amount);
            continue;
        }

        const convertedAmount = convertCurrencyAmount(
            amount,
            currency,
            defaultCurrency,
            rates,
            baseCurrency,
        );

        if (convertedAmount === null) {
            conversionState = GROUP_NET_CONVERSION_STATES.UNAVAILABLE;
            break;
        }

        conversionState = GROUP_NET_CONVERSION_STATES.CONVERTED;
        netAmount += convertedAmount;
        netMagnitude += Math.abs(convertedAmount);
    }

    netAmount = normalizeFloatingPointZero(netAmount, netMagnitude);

    const latestActivityAt = getLatestGroupActivityAt(group);
    const isAutoHidden =
        isSettled && nowTimestamp - latestActivityAt > GROUP_SETTLED_AUTO_HIDE_SECONDS;

    if (conversionState === GROUP_NET_CONVERSION_STATES.UNAVAILABLE) {
        return {
            group,
            isSettled,
            activeCurrencyCount,
            sourceCurrencyBalance,
            netAmount: null,
            netCurrency: defaultCurrency,
            conversionState,
            filterBucket: isSettled
                ? GROUP_CARD_FILTER_BUCKETS.SETTLED
                : GROUP_CARD_FILTER_BUCKETS.UNAVAILABLE,
            latestActivityAt,
            isAutoHidden,
        };
    }

    let filterBucket: GroupCardFilterBucket = GROUP_CARD_FILTER_BUCKETS.NEUTRAL;

    if (isSettled) {
        filterBucket = GROUP_CARD_FILTER_BUCKETS.SETTLED;
    } else if (netAmount > 0) {
        filterBucket = GROUP_CARD_FILTER_BUCKETS.OWED;
    } else if (netAmount < 0) {
        filterBucket = GROUP_CARD_FILTER_BUCKETS.OWES;
    }

    return {
        group,
        isSettled,
        activeCurrencyCount,
        sourceCurrencyBalance,
        netAmount,
        netCurrency: defaultCurrency,
        conversionState,
        filterBucket,
        latestActivityAt,
        isAutoHidden,
    };
};

export const selectGroupsCardsView = (
    groups: Group[],
    options: GroupsCardsViewOptions,
): GroupsCardsView => {
    const displayedGroups: GroupCardViewModel[] = [];
    const hiddenSettledGroups: GroupCardViewModel[] = [];
    const normalizedQuery = options.query.trim().toLowerCase();

    for (const group of groups) {
        const groupModel = selectGroupCardViewModel(group, options);
        const isSelected = group.id === options.selectedGroupId;
        const matchesSearch =
            normalizedQuery.length === 0 ||
            group.name.toLowerCase().includes(normalizedQuery);

        if (!matchesSearch) {
            continue;
        }

        if (groupModel.isSettled) {
            if (
                !isSelected &&
                options.filter !== GROUP_DEBT_FILTERS.ALL
            ) {
                continue;
            }

            if (!groupModel.isAutoHidden || normalizedQuery.length > 0 || isSelected) {
                displayedGroups.push(groupModel);
            } else {
                hiddenSettledGroups.push(groupModel);
            }

            continue;
        }

        if (
            !isSelected &&
            options.filter !== GROUP_DEBT_FILTERS.ALL &&
            groupModel.filterBucket !== options.filter
        ) {
            continue;
        }

        displayedGroups.push(groupModel);
    }

    return {
        displayedGroups,
        hiddenSettledGroups,
        settledCount: hiddenSettledGroups.length,
    };
};
