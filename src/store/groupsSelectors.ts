import type { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import type { Group } from 'api/chipin.types';
import { sortBalancesByCurrency } from 'helpers/currencies';

import { calcBalancesSummary } from './commonSelectors';
import type { GroupsStore } from './groupsStore';

export const selectGroups = (s: GroupsStore) => s.groups;
export const selectSelectedGroup = (s: GroupsStore) => s.selectedGroup;
export const selectGroupBalances = (group: Group): BalancesMap => {
    return group.members.reduce<BalancesMap>((groupBalances, member) => {
        Object.values(member.balancesByCurrency).forEach(balance => {
            const existingBalance = groupBalances[balance.currency];
            groupBalances[balance.currency] = {
                currency: balance.currency,
                netBalance: (existingBalance?.netBalance ?? 0) + balance.netBalance,
            };
        });

        return groupBalances;
    }, {});
};

export const selectGroupNonZeroBalances = (
    group: Group,
    rates: CurrenciesRates,
    baseCurrency: string,
): BalanceEntry[] =>
    sortBalancesByCurrency(
        Object.values(selectGroupBalances(group)).filter(entry => entry.netBalance !== 0),
        rates,
        baseCurrency,
        baseCurrency,
    );

export const calcGroupSummary = (
    balances: BalancesMap,
    base: string,
    rates: CurrenciesRates,
    defaultCurrency = base,
) => {
    const entries = Object.values(balances);
    const { netTotalInBase, owedTotalInBase, owingTotalInBase } = calcBalancesSummary(
        defaultCurrency,
        rates,
        base,
        {
            balances,
        },
    );

    return {
        oweEntries: sortBalancesByCurrency(
            entries.filter(e => e.netBalance < 0),
            rates,
            base,
            defaultCurrency,
        ),
        owedEntries: sortBalancesByCurrency(
            entries.filter(e => e.netBalance > 0),
            rates,
            base,
            defaultCurrency,
        ),
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
    };
};
