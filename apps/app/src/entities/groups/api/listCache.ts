// The cached groups list on a given client, changed only after a write or a denial (#669: a
// query function writes no other cache, `50-api-data.md` §Query Functions): the group mutations
// (`groupCache.ts`) write the groups the server just returned, and a reload asks the server for
// the list again. The edits send no request of their own, except the reload a race leaves owed.
import type { QueryClient } from '@tanstack/react-query';

import { type GroupsListData, upsertGroupInList } from '../model/groupsList';
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

/**
 * Puts a group a write just returned (confirmed by the server) into the cached list. Never
 * rejects.
 */
export const putGroupInCachedList = (client: QueryClient, group: Group): Promise<void> =>
    settleListDebt(
        client,
        editGroupsList(client, data => upsertGroupInList(data, group)),
    );

/**
 * After a change of the groups (a write, a member or ledger change, a denied group page): an
 * active `groups.list` refetches now, an inactive one on its next mount. A running load may
 * predate the change, so it is cancelled first (`cancelRefetch` alone restarts it only when the
 * entry has data). The list data is never edited: the server's list decides.
 */
export const reloadGroupsList = (client: QueryClient): Promise<void> =>
    client
        .cancelQueries({ queryKey: listKey })
        .then(() => client.invalidateQueries({ queryKey: listKey }, { cancelRefetch: true }));
