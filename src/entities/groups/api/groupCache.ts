// The cached group queries after a change of a group, on a given client: a write that returned the
// group (create, update, cover, join), a change of its members or its ledger (a kicked member, an
// expense, a settlement), a group the user lost (removed, left). Never rejects.
import type { QueryClient } from '@tanstack/react-query';

import { firstGroupActivityPage, type GroupActivityData } from '../model/groupActivity';
import { type GroupsListData, upsertGroupInList } from '../model/groupsList';
import type { Group } from '../model/types';

import { editGroupsList, settleListDebt } from './listCache';
import { groupDetailQueryOptions, groupsKeys, seedGroupActivity } from './queries';

const listKey = groupsKeys.list();

/**
 * After a change of the groups: an active `groups.list` refetches now, an inactive one on its next
 * mount. A running load may predate the change, so it is cancelled first (`cancelRefetch` alone
 * restarts it only when the entry has data).
 */
export const reloadGroupsList = (client: QueryClient): Promise<void> =>
    client
        .cancelQueries({ queryKey: listKey })
        .then(() => client.invalidateQueries({ queryKey: listKey }, { cancelRefetch: true }));

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
 * A group a write just returned (confirmed by the server) becomes its detail at once (a running
 * detail read may predate the write: it is cancelled first), and its activity loads again, or,
 * with none cached, is seeded from the page the group carries: a fresh detail is not read again,
 * so the seed is what a read would do, and opening the group then sends no activity request.
 * Cached or loading activity wins. The list is the caller's.
 */
export const writeGroupDetail = (client: QueryClient, group: Group): Promise<void> => {
    const writtenAt = Date.now();

    void client.cancelQueries({ queryKey: groupsKeys.detail(group.id) });
    client.setQueryData<Group>(groupsKeys.detail(group.id), group, { updatedAt: writtenAt });
    return reloadGroupActivity(client, group.id).then(() => {
        seedGroupActivity(client, group.id, group.recentActivities, writtenAt);
    });
};

/**
 * A group a write just returned goes into the cached list at once, then the list reloads, and the
 * written group stays in it whatever the reload read, unless the write is no longer current (a
 * sign-out, an account switch).
 */
export const putGroupAndReloadList = (
    client: QueryClient,
    group: Group,
    isCurrent: () => boolean,
): Promise<void> => {
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

/**
 * After a change of a group (an expense, a settlement, a kicked member), on any page: its detail
 * is read again (a running read cancelled first) whether a group page shows it or not, so the read
 * also updates the group in the list (its card's balances); its activity loads again. A failed
 * read changes nothing; a denied one drops the group from the list.
 */
export const refreshGroup = (client: QueryClient, groupId: string): Promise<void> => {
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
export const forgetGroup = (client: QueryClient, groupId: string): void => {
    removeWhenUnobserved(client, groupsKeys.detail(groupId));
    removeWhenUnobserved(client, groupsKeys.activity(groupId));
};
