// The cached group queries after a change of a group, on a given client: a write that returned the
// group (create, update, cover, join), a change of its members or its ledger (a kicked member, an
// expense, a settlement), a group the user lost (removed, left). Never rejects.
import type { Query, QueryCache, QueryClient } from '@tanstack/react-query';

import {
    firstActivityPageParam,
    firstGroupActivityPage,
    type GroupActivityData,
} from '../model/groupActivity';
import { type GroupsListData, upsertGroupInList } from '../model/groupsList';
import type { Group, GroupActivityPage } from '../model/types';

import { editGroupsList, reloadGroupsList, settleListDebt } from './listCache';
import {
    groupDetailQueryOptions,
    groupsKeys,
    isGroupQueryLeaving,
    setGroupQueryLeaving,
} from './queries';

const listKey = groupsKeys.list();

/**
 * The mutations' documented seed (`50-api-data.md` §Query Functions): the first page of a group's
 * activity from the page a write's answer carries (confirmed by the server), when the activity has
 * nothing cached and is not loading, so opening the group sends no activity request. A seed never
 * replaces cached or loading activity (a newer read wins). It is as old as the write (`updatedAt`).
 */
const seedGroupActivity = (
    client: QueryClient,
    groupId: string,
    page: GroupActivityPage,
    updatedAt: number,
): void => {
    const queryKey = groupsKeys.activity(groupId);
    const state = client.getQueryState(queryKey);

    if (state?.data !== undefined || (state?.fetchStatus ?? 'idle') !== 'idle') {
        return;
    }
    client.setQueryData<GroupActivityData>(
        queryKey,
        { pages: [page], pageParams: [firstActivityPageParam()] },
        { updatedAt },
    );
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

// The pending removal of each forgotten group, per cache, while a page still shows it
// (`forgetGroup`): a second forget replaces the first.
const pendingRemovals = new WeakMap<QueryCache, Map<string, () => void>>();

/**
 * A group a write just returned (confirmed by the server) becomes its detail at once (a running
 * detail read may predate the write: it is cancelled first), and its activity loads again, or,
 * with none cached, is seeded from the page the group carries (`seedGroupActivity`): a fresh
 * detail is not read again, and opening the group then sends no activity request.
 * Cached or loading activity wins. The list is the caller's. A group the user just left, while a
 * page still shows it (`forgetGroup`), is not written: its page keeps what it shows until it
 * unmounts, then the group is removed; a rejoin ends the leave first (`keepRejoinedGroup`). An
 * update or a cover upload that a leave, a removal or a join overtook does not call this at all,
 * whether the group's page is still mounted or has unmounted (the mutations' membership counts);
 * this check is the cache-side guard for the mounted case.
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
 * sign-out, an account switch, or a change of the group's membership meanwhile: a leave, a
 * removal or a join).
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
// denied one is left to the list reload of the caller (`refreshGroup`): the server's list no
// longer has the group. A group the user just left is not read (`forgetGroup`).
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
 * is read again (a running read cancelled first) whether a group page shows it or not, its
 * activity loads again, and the list reloads (`reloadGroupsList`: its card's balances; an active
 * list now, an inactive one on its next mount). The detail read writes no other cache (#669). A
 * failed read changes nothing; a denied group leaves the list through that reload.
 */
export const refreshGroup = (client: QueryClient, groupId: string): Promise<void> =>
    Promise.all([
        readGroupDetail(client, groupId),
        reloadGroupActivity(client, groupId),
        reloadGroupsList(client),
    ]).then(() => undefined);

/**
 * As `refreshGroup`, but settles once the activity has reloaded, without waiting for the detail
 * read or the list reload: offline they wait for the reconnect, and a write's loading flag must
 * not.
 */
export const startGroupRefresh = (client: QueryClient, groupId: string): Promise<void> => {
    void readGroupDetail(client, groupId);
    void reloadGroupsList(client);
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
