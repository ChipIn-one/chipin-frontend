// The groups entity (spec 03 §1.2, §6 row 4): the user's groups list, 60 s fresh, persisted (its
// first page only, `trimmingPersister`). The detail and activity keys are reserved for 03-10b; the
// group page still reads them through the legacy `groupsStore` until then.
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';

import { fetchApiUserGroups } from 'api/chipin';
import type { Group } from 'api/chipin.types';

import { flattenGroupsList, type GroupsListData } from '../model/groupsList';
import type { GroupsListPage } from '../model/types';

export const GROUPS_LIST_STALE_TIME = 60_000;
// The first page has no cursor (a function: a typed constant would narrow to `null`).
const firstPageParam = (): string | null => null;

export const groupsKeys = {
    all: ['groups'] as const,
    list: () => [...groupsKeys.all, 'list'] as const,
    detail: (groupId: string) => [...groupsKeys.all, 'detail', groupId] as const,
    activity: (groupId: string) => [...groupsKeys.all, 'activity', groupId] as const,
};

// LEGACY until 03-10b/03-12: the list comes through the legacy `src/api` layer, see `GroupsListPage`.
const fetchGroupsPage = (cursor: string | null, signal: AbortSignal): Promise<GroupsListPage> =>
    fetchApiUserGroups(signal, cursor ?? undefined).then(({ items, nextCursor }) => ({
        items,
        nextCursor,
    }));

/**
 * The groups, newest first: the first page without a cursor, then by `nextCursor` until null. The
 * readers load the first page only (as the legacy store did); a refetch reloads what is loaded.
 */
export const groupsListQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: groupsKeys.list(),
        staleTime: GROUPS_LIST_STALE_TIME,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchGroupsPage(pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
    });

const selectGroups = (data: GroupsListData): Group[] => flattenGroupsList(data);

interface GroupsListQueryParams {
    /** False while signed out: the groups are never requested without a session. */
    enabled: boolean;
}

/** The groups of all loaded pages as one list without duplicates. */
export const useGroupsListQuery = ({ enabled }: GroupsListQueryParams) =>
    useInfiniteQuery({ ...groupsListQueryOptions(), select: selectGroups, enabled });
