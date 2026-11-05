import type { BalanceEntry, CurrenciesRates } from 'api/chipin.raw.types';
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
    legacyAmountFromMoney,
    legacyCurrencyOrDefault,
    legacyEntryFromMoney,
    legacyPartitionEntries,
    legacyRateLookup,
    legacySumEntriesByCurrency,
    legacySummarizeEntries,
    summarizeBalances,
} from 'entities/balance';
import { sortBalancesByCurrency } from 'helpers/currencies';
import { displaySign } from 'shared/money';

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

        const { owe: balancesYouOwe, owed: balancesOwedToYou } = legacyPartitionEntries(
            Object.values(member.balancesByCurrency),
        );

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

const groupMemberBalances = (group: Group): BalanceEntry[] =>
    group.members.flatMap(member => Object.values(member.balancesByCurrency));

export const selectGroupBalances = (group: Group): GroupBalances => {
    const { owed, owe } = legacyPartitionEntries(groupMemberBalances(group));

    return {
        owedEntries: legacySumEntriesByCurrency(owed).map(legacyEntryFromMoney),
        oweEntries: legacySumEntriesByCurrency(owe).map(legacyEntryFromMoney),
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
    const { netTotalInBase, owedTotalInBase, owingTotalInBase } = legacySummarizeEntries(
        [...owedEntries, ...oweEntries],
        rates,
        base,
        defaultCurrency,
    );

    return {
        oweEntries: sortBalancesByCurrency(oweEntries, rates, base, defaultCurrency),
        owedEntries: sortBalancesByCurrency(owedEntries, rates, base, defaultCurrency),
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
    // Currencies with at least one open member balance, each summed exactly.
    const { owed, owe } = legacyPartitionEntries(groupMemberBalances(group));
    const totals = legacySumEntriesByCurrency([...owed, ...owe]);
    const activeCurrencyCount = totals.length;
    const isSettled = activeCurrencyCount === 0;
    const [singleTotal] = totals;
    const sourceCurrencyBalance =
        activeCurrencyCount === 1 && singleTotal ? legacyEntryFromMoney(singleTotal) : null;
    const netCurrency = legacyCurrencyOrDefault(defaultCurrency);
    const summary = summarizeBalances(totals, netCurrency, legacyRateLookup(rates, baseCurrency));
    let conversionState: GroupNetConversionState = GROUP_NET_CONVERSION_STATES.SAME_CURRENCY;

    if (summary.unconverted.length > 0) {
        conversionState = GROUP_NET_CONVERSION_STATES.UNAVAILABLE;
    } else if (summary.converted) {
        conversionState = GROUP_NET_CONVERSION_STATES.CONVERTED;
    }

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
            netCurrency,
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
    } else if (displaySign(summary.net) > 0) {
        filterBucket = GROUP_CARD_FILTER_BUCKETS.OWED;
    } else if (displaySign(summary.net) < 0) {
        filterBucket = GROUP_CARD_FILTER_BUCKETS.OWES;
    }

    return {
        group,
        isSettled,
        activeCurrencyCount,
        sourceCurrencyBalance,
        netAmount: legacyAmountFromMoney(summary.net),
        netCurrency,
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
            normalizedQuery.length === 0 || group.name.toLowerCase().includes(normalizedQuery);

        if (!matchesSearch) {
            continue;
        }

        if (groupModel.isSettled) {
            if (!isSelected && options.filter !== GROUP_DEBT_FILTERS.ALL) {
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
