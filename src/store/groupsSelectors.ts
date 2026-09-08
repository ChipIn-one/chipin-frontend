import type { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import type { Group, GroupUser } from 'api/chipin.types';
import { getBalanceEntriesSummary, sortBalancesByCurrency } from 'helpers/currencies';

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
