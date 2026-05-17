import { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import { Group } from 'api/chipin.types';

import { calcBalancesSummary } from './commonSelectors';
import { GroupsStore } from './groupsStore';

export const selectGroups = (s: GroupsStore) => s.groups;
export const selectSelectedGroup = (s: GroupsStore) => s.selectedGroup;
export const selectGroupBalances = (group: Group): BalanceEntry[] => Object.values(group.balances);

export const selectGroupNonZeroBalances = (group: Group): BalanceEntry[] =>
    selectGroupBalances(group).filter(entry => entry.netBalance !== 0);

// TODO: move summary calc for using group defaultCurrency (premium)
export const calcGroupSummary = (balances: BalancesMap, base: string, rates: CurrenciesRates) => {
    const entries = Object.values(balances);
    const { netTotalInBase, owedTotalInBase, owingTotalInBase } = calcBalancesSummary(base, rates, {
        balances,
    });

    return {
        oweEntries: entries.filter(e => e.netBalance < 0),
        owedEntries: entries.filter(e => e.netBalance > 0),
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
    };
};
