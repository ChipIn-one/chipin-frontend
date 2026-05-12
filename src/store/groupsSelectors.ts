import { BalanceEntry, Group } from 'api/chipin.types';

import { GroupsStore } from './groupsStore';

export const selectGroups = (s: GroupsStore) => s.groups;
export const selectSelectedGroup = (s: GroupsStore) => s.selectedGroup;

export const selectGroupNonZeroBalances = (group: Group): BalanceEntry[] =>
    Object.values(group.balances).filter(
        entry => entry.netBalance !== null && !entry.netBalance.eq(0),
    );
