// The groups list query seen from the legacy stores (spec 03 §6 row 4): the session start loads it
// on the tab user's QueryClient, the legacy group actions keep it correct after their writes, and
// the expense editor reads the cached groups. Never the reverse direction.
import type { QueryClient } from '@tanstack/react-query';

import type { Group } from 'api/chipin.types';
import {
    flattenGroupsList,
    groupsKeys,
    type GroupsListData,
    removeGroupFromList,
    upsertGroupInList,
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
 * After a legacy change of the groups: an active `groups.list` refetches now, an inactive one on
 * its next mount. A running load may predate the change, so it is cancelled first (`cancelRefetch`
 * alone restarts it only when the entry has data). Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const invalidateGroupsList = (): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    return client
        .cancelQueries({ queryKey: listKey })
        .then(() => client.invalidateQueries({ queryKey: listKey }, { cancelRefetch: true }));
};

// What an edit of the cached list leaves owed: a load it cancelled must run again (`reload`), and
// an entry already marked stale stays stale (`stale`), without a request now.
type ListDebt = 'none' | 'stale' | 'reload';

// Edits the cached list in place, without a request. A running load may predate the change: it is
// cancelled before the write (the cancel restores the entry synchronously, so the write is not
// undone). The list keeps its age: one group read from the server does not make the rest of it
// fresh.
const editGroupsList = (
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

const settleDebt = (client: QueryClient, debt: ListDebt): Promise<void> => {
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
 * Puts a group read or written by a legacy action into the cached list, without a request of its
 * own. `readStartedAt`: when a read (the group detail) was sent; when the list loaded since then,
 * the group is not written and the list loads again instead (one more request). Without it the
 * group is a write the server just confirmed (a created group). Never rejects.
 */
// TODO(03-11): the group detail (03-10b) writes its own entry.
export const putGroupInList = (group: Group, readStartedAt?: number): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    if (isListLoadedSince(client, readStartedAt)) {
        return settleDebt(client, 'reload');
    }
    return settleDebt(
        client,
        editGroupsList(client, data => upsertGroupInList(data, group)),
    );
};

/**
 * Drops a group the user can no longer read (a 403/404 on its detail) from the cached list: a
 * denial always applies, whenever the list loaded. Never rejects.
 */
// TODO(03-11): the group detail (03-10b) writes its own entry.
export const dropGroupFromList = (groupId: string): Promise<void> => {
    const client = tabUserClient();

    return client
        ? settleDebt(
              client,
              editGroupsList(client, data => removeGroupFromList(data, groupId)),
          )
        : Promise.resolve();
};

/**
 * After a legacy group write: the written group goes into the cached list at once, then the list
 * reloads, and the written group stays in it whatever the reload read (as the legacy list did),
 * unless the write is no longer current (a sign-out, a reset). Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const reloadGroupsListWith = (group: Group, isCurrent: () => boolean): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const upsert = (data: GroupsListData): GroupsListData => upsertGroupInList(data, group);

    // Any load running is cancelled by the write: the reload below replaces it.
    editGroupsList(client, upsert);
    return client.invalidateQueries({ queryKey: listKey }).then(() => {
        if (isCurrent()) {
            return settleDebt(client, editGroupsList(client, upsert));
        }
        return undefined;
    });
};
