// Edits of the cached groups list on a given client: the group detail query writes the group it
// read (or drops one it may not read), and the legacy group actions (`store/groupsList.ts`) write
// the groups they changed. Never a request of its own, except the reload a race leaves owed.
import type { QueryClient } from '@tanstack/react-query';

import { type GroupsListData, removeGroupFromList, upsertGroupInList } from '../model/groupsList';
import type { Group } from '../model/types';

import { groupsKeys } from './keys';

const listKey = groupsKeys.list();

// What an edit of the cached list leaves owed: a load it cancelled must run again (`reload`), and
// an entry already marked stale stays stale (`stale`), without a request now.
export type ListDebt = 'none' | 'stale' | 'reload';

/**
 * Edits the cached list in place, without a request. A running load may predate the change: it is
 * cancelled before the write (the cancel restores the entry synchronously, so the write is not
 * undone). The list keeps its age: one group read from the server does not make the rest of it
 * fresh.
 */
export const editGroupsList = (
    client: QueryClient,
    edit: (data: GroupsListData) => GroupsListData,
): ListDebt => {
    // A load paused offline counts too: the cancel below cancels it as well.
    const wasFetching = (client.getQueryState(listKey)?.fetchStatus ?? 'idle') !== 'idle';

    void client.cancelQueries({ queryKey: listKey });
    const state = client.getQueryState<GroupsListData>(listKey);

    if (state?.data !== undefined) {
        client.setQueryData<GroupsListData>(listKey, edit(state.data), {
            updatedAt: state.dataUpdatedAt,
        });
    }
    if (wasFetching) {
        return 'reload';
    }
    return state?.isInvalidated === true ? 'stale' : 'none';
};

export const settleListDebt = (client: QueryClient, debt: ListDebt): Promise<void> => {
    if (debt === 'none') {
        return Promise.resolve();
    }
    return client.invalidateQueries({
        queryKey: listKey,
        refetchType: debt === 'reload' ? 'active' : 'none',
    });
};

// Whether the list loaded since a read was sent. Its load may have started before the read, so it
// can be older than the read's answer or newer: neither may overwrite the other (a stale response
// never overwrites newer state), and the server decides with one more list load. The edits keep
// the list's age, so only a list load moves it.
const isListLoadedSince = (client: QueryClient, readStartedAt: number | undefined): boolean =>
    readStartedAt !== undefined &&
    (client.getQueryState(listKey)?.dataUpdatedAt ?? 0) >= readStartedAt;

/**
 * Puts a group into the cached list. `readStartedAt`: when a read (the group detail) was sent;
 * when the list loaded since then, the group is not written and the list loads again instead (one
 * more request). Without it the group is a write the server just confirmed. Never rejects.
 */
export const putGroupInCachedList = (
    client: QueryClient,
    group: Group,
    readStartedAt?: number,
): Promise<void> => {
    if (isListLoadedSince(client, readStartedAt)) {
        return settleListDebt(client, 'reload');
    }
    return settleListDebt(
        client,
        editGroupsList(client, data => upsertGroupInList(data, group)),
    );
};

/**
 * Drops a group the user can no longer read (a 403/404 on its detail): a denial always applies,
 * whenever the list loaded. Never rejects.
 */
export const dropGroupFromCachedList = (client: QueryClient, groupId: string): Promise<void> =>
    settleListDebt(
        client,
        editGroupsList(client, data => removeGroupFromList(data, groupId)),
    );
