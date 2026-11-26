// The group queries seen from the legacy stores (spec 03 §6 row 4): the session start loads the
// list on the tab user's QueryClient, the ledger write hooks keep a group's detail and its
// activity correct after their writes, and the expense editor reads the cached groups. Never the
// reverse direction. The group writes are `entities/groups` mutations (03-11).
import {
    flattenGroupsList,
    type Group,
    groupsKeys,
    type GroupsListData,
    startGroupRefresh,
} from 'entities/groups';

import { tabUserClient } from './sessionUser';

const listKey = groupsKeys.list();

/**
 * Marks the user's `groups.list` stale at a session start: a load running is joined and one that
 * finished after `since` is reused, so a session start sends one request. No client yet (a first
 * sign-in) is a no-op: its first mount loads them. Never rejects.
 */
export const loadGroupsListForSession = (since: number = Date.now()): Promise<void> => {
    const client = tabUserClient();

    if (!client || (client.getQueryState(listKey)?.dataUpdatedAt ?? 0) >= since) {
        return Promise.resolve();
    }
    return client.invalidateQueries({ queryKey: listKey }, { cancelRefetch: false });
};

/** The cached groups of this tab's user, for legacy store actions (the expense editor). */
export const getCachedGroups = (): Group[] | undefined => {
    const data = tabUserClient()?.getQueryData<GroupsListData>(listKey);

    return data ? flattenGroupsList(data) : undefined;
};

/**
 * After a legacy change of a group (an expense, a settlement), on any page: its detail is read
 * again, its activity loads again and the list reloads (`startGroupRefresh`). Settles once the
 * activity has, not waiting for the detail read or the list: offline they wait for the reconnect,
 * and the write's loading flag waits for this. Never rejects.
 */
// TODO: the ledger write hooks (`hooks/useLedgerMutations.ts`) call `startGroupRefresh` on the
// write's own client instead (the activity store that also used it went with 03-12).
export const invalidateGroup = (groupId: string): Promise<void> => {
    const client = tabUserClient();

    return client ? startGroupRefresh(client, groupId) : Promise.resolve();
};
