import { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import { Group } from 'api/chipin.types';
import { sortBalancesByCurrency } from 'helpers/currencies';

import { calcBalancesSummary } from './commonSelectors';
import { GroupsStore } from './groupsStore';

export const selectGroups = (s: GroupsStore) => s.groups;
export const selectSelectedGroup = (s: GroupsStore) => s.selectedGroup;
export const selectGroupBalances = (group: Group): BalanceEntry[] => Object.values(group.balances);

export const selectGroupNonZeroBalances = (
    group: Group,
    rates: CurrenciesRates,
    baseCurrency: string,
): BalanceEntry[] =>
    sortBalancesByCurrency(
        selectGroupBalances(group).filter(entry => entry.netBalance !== 0),
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
