// The group queries seen from the legacy stores (spec 03 §6 row 4): the session start loads the
// list on the tab user's QueryClient, the legacy ledger actions keep a group's detail and its
// activity correct after their writes, and the expense editor reads the cached groups. Never the
// reverse direction. The group writes are `entities/groups` mutations (03-11).
import {
    flattenGroupsList,
    type Group,
    groupsKeys,
    type GroupsListData,
    refreshGroup,
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
 * again and its activity loads again (`refreshGroup`). Never rejects.
 */
// TODO(03-12): goes with the activity store moving to entities/activity.
export const invalidateGroup = (groupId: string): Promise<void> => {
    const client = tabUserClient();

    return client ? refreshGroup(client, groupId) : Promise.resolve();
};
