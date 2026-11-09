// The group queries seen from the legacy stores (spec 03 §6 row 4): the session start loads the
// list on the tab user's QueryClient, the legacy group and ledger actions keep the list, a group's
// detail and its activity correct after their writes, and the expense editor reads the cached
// groups. Never the reverse direction. A group's detail read keeps the list current itself
// (`entities/groups`).
import type { QueryClient } from '@tanstack/react-query';

import type { Group } from 'api/chipin.types';
import {
    editGroupsList,
    firstGroupActivityPage,
    flattenGroupsList,
    type GroupActivityData,
    groupsKeys,
    type GroupsListData,
    putGroupInCachedList,
    settleListDebt,
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

/**
 * Puts a group a legacy action just wrote (a created group, confirmed by the server) into the
 * cached list, without a request of its own. Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const putGroupInList = (group: Group): Promise<void> => {
    const client = tabUserClient();

    return client ? putGroupInCachedList(client, group) : Promise.resolve();
};

// Cuts a group's cached activity to its first page, keeping its age: its refetch is one request.
const trimGroupActivity = (client: QueryClient, groupId: string): void => {
    const queryKey = groupsKeys.activity(groupId);
    const state = client.getQueryState<GroupActivityData>(queryKey);

    if (state?.data && state.data.pages.length > 1) {
        client.setQueryData<GroupActivityData>(queryKey, firstGroupActivityPage(state.data), {
            updatedAt: state.dataUpdatedAt,
        });
    }
};

// A change of the group: a running load of its activity may predate it, so it is cancelled first.
const reloadGroupActivity = (client: QueryClient, groupId: string): Promise<void> => {
    const queryKey = groupsKeys.activity(groupId);

    return client.cancelQueries({ queryKey }).then(() => {
        trimGroupActivity(client, groupId);
        return client.invalidateQueries({ queryKey });
    });
};

/**
 * After a legacy write that returned the group (an update, a cover, a join): the group becomes its
 * detail at once (a running detail read may predate the write: it is cancelled first), and its
 * activity loads again. The list is the caller's (`reloadGroupsListWith`). Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const putGroupDetail = (group: Group): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const queryKey = groupsKeys.detail(group.id);

    void client.cancelQueries({ queryKey });
    client.setQueryData<Group>(queryKey, group);
    return reloadGroupActivity(client, group.id);
};

/**
 * After a legacy change of a group (an expense, a settlement, a kicked member): its detail and
 * activity load again, a running load cancelled first; the detail read then updates the list.
 * Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const invalidateGroup = (groupId: string): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const queryKey = groupsKeys.detail(groupId);

    return Promise.all([
        client
            .cancelQueries({ queryKey })
            .then(() => client.invalidateQueries({ queryKey }, { cancelRefetch: true })),
        reloadGroupActivity(client, groupId),
    ]).then(() => undefined);
};

/** After the user removed or left a group: its cached detail and activity are dropped. */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const forgetGroup = (groupId: string): void => {
    const client = tabUserClient();

    for (const queryKey of [groupsKeys.detail(groupId), groupsKeys.activity(groupId)]) {
        void client?.cancelQueries({ queryKey });
        client?.removeQueries({ queryKey });
    }
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
            return settleListDebt(client, editGroupsList(client, upsert));
        }
        return undefined;
    });
};
