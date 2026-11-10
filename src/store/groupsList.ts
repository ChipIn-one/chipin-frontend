// The group queries seen from the legacy stores (spec 03 §6 row 4): the session start loads the
// list on the tab user's QueryClient, the legacy group and ledger actions keep the list, a group's
// detail and its activity correct after their writes, and the expense editor reads the cached
// groups. Never the reverse direction. A group's detail read keeps the list current itself
// (`entities/groups`).
import type { QueryClient } from '@tanstack/react-query';

import type { Group as LegacyGroup } from 'api/chipin.types';
import {
    editGroupsList,
    firstGroupActivityPage,
    flattenGroupsList,
    type Group,
    type GroupActivityData,
    groupDetailQueryOptions,
    groupsKeys,
    type GroupsListData,
    putGroupInCachedList,
    seedGroupActivity,
    settleListDebt,
    upsertGroupInList,
} from 'entities/groups';

import { domainGroupFromLegacy } from './legacyGroup';
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
export const putGroupInList = (group: LegacyGroup): Promise<void> => {
    const client = tabUserClient();

    return client ? putGroupInCachedList(client, domainGroupFromLegacy(group)) : Promise.resolve();
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
 * activity loads again, or, with none cached, is seeded from the page the group carries. The list
 * is the caller's (`reloadGroupsListWith`). Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const putGroupDetail = (group: LegacyGroup): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const queryKey = groupsKeys.detail(group.id);
    const detail = domainGroupFromLegacy(group);
    const writtenAt = Date.now();

    void client.cancelQueries({ queryKey });
    client.setQueryData<Group>(queryKey, detail, { updatedAt: writtenAt });
    // A fresh detail is not read again, so its activity page seeds the activity here (as a read
    // would): opening the group then sends no activity request. Cached or loading activity wins.
    return reloadGroupActivity(client, group.id).then(() => {
        seedGroupActivity(client, group.id, detail.recentActivities, writtenAt);
    });
};

/**
 * After a legacy change of a group (an expense, a settlement, a kicked member), on any page: its
 * detail is read again (a running read cancelled first) whether a group page shows it or not, so
 * the read also updates the group in the list (its card's balances); its activity loads again.
 * Never rejects (a failed read changes nothing; a denied one drops the group from the list).
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
            .then(() => client.fetchQuery({ ...groupDetailQueryOptions(groupId), staleTime: 0 }))
            .catch(() => undefined),
        reloadGroupActivity(client, groupId),
    ]).then(() => undefined);
};

// Removes a cached query once nothing shows it: a group page still mounted would otherwise build
// it again and read a group that is gone (a 404 flash before the page navigates away).
const removeWhenUnobserved = (client: QueryClient, queryKey: readonly unknown[]): void => {
    const cache = client.getQueryCache();
    const query = cache.find({ queryKey, exact: true });

    if (!query) {
        return;
    }
    void client.cancelQueries({ queryKey, exact: true });
    if (query.getObserversCount() === 0) {
        cache.remove(query);
        return;
    }
    const unsubscribe = cache.subscribe(event => {
        if (event.query !== query) {
            return;
        }
        if (event.type === 'removed') {
            unsubscribe();
        } else if (event.type === 'observerRemoved' && query.getObserversCount() === 0) {
            unsubscribe();
            cache.remove(query);
        }
    });
};

/**
 * After the user removed or left a group: its cached detail and activity are dropped, once the
 * page showing them is gone (nothing reads them again meanwhile).
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const forgetGroup = (groupId: string): void => {
    const client = tabUserClient();

    if (client) {
        removeWhenUnobserved(client, groupsKeys.detail(groupId));
        removeWhenUnobserved(client, groupsKeys.activity(groupId));
    }
};

/**
 * After a legacy group write: the written group goes into the cached list at once, then the list
 * reloads, and the written group stays in it whatever the reload read (as the legacy list did),
 * unless the write is no longer current (a sign-out, a reset). Never rejects.
 */
// TODO(03-11): goes with the group mutations moving to entities/groups.
export const reloadGroupsListWith = (
    legacyGroup: LegacyGroup,
    isCurrent: () => boolean,
): Promise<void> => {
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    const group = domainGroupFromLegacy(legacyGroup);
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
