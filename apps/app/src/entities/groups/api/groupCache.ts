// The cached group queries after a change of a group, on a given client: a write that returned the
// group (create, update, cover, join), a change of its members or its ledger (a kicked member, an
// expense, a settlement), a group the user lost (removed, left). Never rejects.
import type { Query, QueryCache, QueryClient } from '@tanstack/react-query';

import { firstGroupActivityPage, type GroupActivityData } from '../model/groupActivity';
import { type GroupsListData, upsertGroupInList } from '../model/groupsList';
import type { Group } from '../model/types';

import { editGroupsList, settleListDebt } from './listCache';
import {
    groupDetailQueryOptions,
    groupsKeys,
    isGroupQueryLeaving,
    seedGroupActivity,
    setGroupQueryLeaving,
} from './queries';

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

// The pending removal of each forgotten group, per cache, while a page still shows it
// (`forgetGroup`): a second forget replaces the first.
const pendingRemovals = new WeakMap<QueryCache, Map<string, () => void>>();

/**
 * A group a write just returned (confirmed by the server) becomes its detail at once (a running
 * detail read may predate the write: it is cancelled first), and its activity loads again, or,
 * with none cached, is seeded from the page the group carries: a fresh detail is not read again,
 * so the seed is what a read would do, and opening the group then sends no activity request.
 * Cached or loading activity wins. The list is the caller's. A group the user just left, while a
 * page still shows it (`forgetGroup`), is not written: its page keeps what it shows until it
 * unmounts, then the group is removed; a rejoin ends the leave first (`keepRejoinedGroup`). An
 * update or a cover upload that a leave overtook does not call this at all, whether the left
 * group's page is still mounted or has unmounted (the mutations' leave count); this check is the
 * cache-side guard for the mounted case.
 */
export const writeGroupDetail = (client: QueryClient, group: Group): Promise<void> => {
    const writtenAt = Date.now();

    if (pendingRemovals.get(client.getQueryCache())?.has(group.id)) {
        return Promise.resolve();
    }
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

// A group's detail read again (a running read cancelled first). A failed read changes nothing; a
// denied one drops the group from the list. A group the user just left is not read (`forgetGroup`).
const readGroupDetail = (client: QueryClient, groupId: string): Promise<void> => {
    const queryKey = groupsKeys.detail(groupId);

    return client
        .cancelQueries({ queryKey })
        .then(() => {
            const query = client.getQueryCache().find({ queryKey, exact: true });

            if (query && isGroupQueryLeaving(query)) {
                return undefined;
            }
            return client
                .fetchQuery({ ...groupDetailQueryOptions(groupId), staleTime: 0 })
                .then(() => undefined);
        })
        .catch(() => undefined);
};

/**
 * After a change of a group (an expense, a settlement, a kicked member), on any page: its detail
 * is read again (a running read cancelled first) whether a group page shows it or not, so the read
 * also updates the group in the list (its card's balances); its activity loads again. A failed
 * read changes nothing; a denied one drops the group from the list.
 */
export const refreshGroup = (client: QueryClient, groupId: string): Promise<void> =>
    Promise.all([readGroupDetail(client, groupId), reloadGroupActivity(client, groupId)]).then(
        () => undefined,
    );

/**
 * As `refreshGroup`, but settles once the activity has reloaded, without waiting for the detail
 * read: offline that read waits for the reconnect, and a write's loading flag must not.
 */
export const startGroupRefresh = (client: QueryClient, groupId: string): Promise<void> => {
    void readGroupDetail(client, groupId);
    return reloadGroupActivity(client, groupId);
};

/**
 * Removes a group's cached detail and activity once nothing shows them. A group page still
 * mounted keeps them meanwhile, but its observers are disabled (`setGroupQueryLeaving`), so a
 * focus or a reconnect does not read a group that is gone (a 404 flash before the page navigates
 * away), and no write lands in them (`writeGroupDetail`). Only a rejoin ends this
 * (`keepRejoinedGroup`): the group is the user's again, and its fresh entry must survive the
 * unmount. Any other write landing meanwhile (an update or a cover upload finishing after the
 * leave) keeps nothing.
 */
const removeGroupWhenUnobserved = (client: QueryClient, groupId: string): void => {
    const cache = client.getQueryCache();
    const removals = pendingRemovals.get(cache) ?? new Map<string, () => void>();
    // The shown queries, by hash, until each is unobserved.
    const pending = new Map<string, Query>();

    removals.get(groupId)?.();
    pendingRemovals.set(cache, removals);
    for (const queryKey of [groupsKeys.detail(groupId), groupsKeys.activity(groupId)]) {
        const query = cache.find({ queryKey, exact: true });

        if (query) {
            const isShown = query.getObserversCount() > 0;

            // Marked before the cancel: nothing restarts the read.
            if (isShown) {
                pending.set(query.queryHash, query);
                setGroupQueryLeaving(query, true);
            }
            void client.cancelQueries({ queryKey, exact: true });
            if (!isShown) {
                cache.remove(query);
            }
        }
    }
    if (pending.size === 0) {
        return;
    }

    const release = (queryHash: string): void => {
        const query = pending.get(queryHash);

        if (query) {
            pending.delete(queryHash);
            setGroupQueryLeaving(query, false);
        }
    };
    // Ends the pending removal: what is still shown stays cached and readable again.
    const cancel = (): void => {
        [...pending.keys()].forEach(release);
        unsubscribe();
        if (removals.get(groupId) === cancel) {
            removals.delete(groupId);
        }
    };
    const unsubscribe = cache.subscribe(event => {
        const { queryHash } = event.query;
        const query = pending.get(queryHash);

        if (query === event.query) {
            if (event.type === 'removed') {
                release(queryHash);
            } else if (event.type === 'observerRemoved' && query.getObserversCount() === 0) {
                release(queryHash);
                cache.remove(query);
            }
            if (pending.size === 0) {
                cancel();
            }
        }
    });

    removals.set(groupId, cancel);
};

/**
 * After the user rejoined a group (a join confirmed by the server): a pending removal of it (a
 * leave while its page is mounted) ends, so what the page shows stays cached and readable again
 * and the joined group can be written. Call it before the join's `writeGroupDetail`.
 */
export const keepRejoinedGroup = (client: QueryClient, groupId: string): void => {
    pendingRemovals.get(client.getQueryCache())?.get(groupId)?.();
};

/**
 * After the user removed or left a group: its cached detail and activity are dropped, once the
 * page showing them is gone (nothing reads them again meanwhile, unless the user rejoins).
 */
export const forgetGroup = (client: QueryClient, groupId: string): void => {
    removeGroupWhenUnobserved(client, groupId);
};
