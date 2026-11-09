// The groups entity (spec 03 §1.2, §6 row 4): the user's groups list (60 s fresh), a group's
// detail with its balances (30 s) and a group's activity previews (30 s, infinite), all persisted
// (the infinite ones as their first page only, `trimmingPersister`). The list and the detail come
// through the legacy `src/api` layer in the legacy shapes (see `model/types.ts`) until 03-10c; the
// activity comes through `api()` as domain items (`toActivityItems`, amounts as `Money`).
import type { Query, QueryClient, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import {
    infiniteQueryOptions,
    queryOptions,
    useInfiniteQuery,
    useQueries,
} from '@tanstack/react-query';

import { fetchApiUserGroupById, fetchApiUserGroups } from 'api/chipin';
import type { Group } from 'api/chipin.types';
import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { toActivityItems } from 'entities/activity';
import { api, ApiError, toApiError } from 'shared/api/client';
import { isNetworkUsable } from 'shared/offline/network';

import {
    firstGroupActivityPage,
    flattenGroupActivity,
    type GroupActivityData,
} from '../model/groupActivity';
import { flattenGroupsList, type GroupsListData } from '../model/groupsList';
import type { GroupActivityPage, GroupsListPage } from '../model/types';

import { groupsKeys } from './keys';
import { dropGroupFromCachedList, putGroupInCachedList } from './listCache';

export { groupsKeys };

export const GROUPS_LIST_STALE_TIME = 60_000;
export const GROUP_DETAIL_STALE_TIME = 30_000;

// The first page has no cursor (functions: a typed constant would narrow to `null`).
const firstPageParam = (): string | null => null;
const firstActivityPageParam = (): number | null => null;

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

interface EnabledParams {
    /** False while signed out: nothing is requested without a session. */
    enabled: boolean;
}

/** The groups of all loaded pages as one list without duplicates. */
export const useGroupsListQuery = ({ enabled }: EnabledParams) =>
    useInfiniteQuery({ ...groupsListQueryOptions(), select: selectGroups, enabled });

/** Whether a failed detail read means the user may not read the group (not a member, removed). */
export const isGroupDeniedError = (error: unknown): boolean =>
    error instanceof ApiError && (error.status === 403 || error.status === 404);

/**
 * Seeds the first page of a group's activity from the page its detail carries, when the activity
 * has nothing cached and is not loading, so opening a group sends one request. A seed never
 * replaces cached or loading activity (a newer read wins). It is as old as the detail read that
 * carried it (`updatedAt`): a seed from an old detail is stale, so the first page loads again.
 */
export const seedGroupActivity = (
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

// A group read keeps the cached list current (03-10a race rules, `putGroupInCachedList`), and a
// denied read drops the group from it. A cancelled read writes nothing, not even a denial: a write
// confirmed meanwhile (an edit, a rejoin) is newer.
const fetchGroupDetail = (
    client: QueryClient,
    groupId: string,
    signal: AbortSignal,
): Promise<Group> => {
    const readStartedAt = Date.now();

    return fetchApiUserGroupById(groupId, signal).then(
        group => {
            if (!signal.aborted) {
                void putGroupInCachedList(client, group, readStartedAt);
            }
            return group;
        },
        (error: unknown) => {
            const apiError = toApiError(error);

            if (!signal.aborted && isGroupDeniedError(apiError)) {
                void dropGroupFromCachedList(client, groupId);
            }
            return Promise.reject(apiError);
        },
    );
};

/** A group with its members' balances; a 403/404 fails with an `ApiError` (never retried). */
export const groupDetailQueryOptions = (groupId: string) =>
    queryOptions({
        queryKey: groupsKeys.detail(groupId),
        staleTime: GROUP_DETAIL_STALE_TIME,
        queryFn: ({ client, signal }) => fetchGroupDetail(client, groupId, signal),
    });

interface GroupDetailQueryParams extends EnabledParams {
    /** Shown while the detail loads for the first time (the group as listed). */
    placeholder: Group | undefined;
}

type GroupDetailOptions = UseQueryOptions<
    Group,
    Error,
    Group,
    ReturnType<typeof groupsKeys.detail>
>;

const selectFirst = (results: UseQueryResult<Group>[]): UseQueryResult<Group> | undefined =>
    results[0];

/**
 * No group (`undefined`): no query at all, not even an idle cache entry (the route has no group).
 */
export const useGroupDetailQuery = (
    groupId: string | undefined,
    { enabled, placeholder }: GroupDetailQueryParams,
) => {
    const queries: GroupDetailOptions[] =
        groupId === undefined
            ? []
            : [{ ...groupDetailQueryOptions(groupId), enabled, placeholderData: placeholder }];

    return useQueries({ queries, combine: selectFirst });
};

// `api()` rejects with an `ApiError`, as the detail's: a 5xx is retried, other 4xx are final.
const fetchGroupActivityPage = (
    groupId: string,
    cursor: number | null,
    signal: AbortSignal,
): Promise<GroupActivityPage> =>
    api('get', '/groups/{groupId}/activity-previews', {
        params: { groupId },
        query: { limit: ACTIVITY_API_LIMIT, ...(cursor === null ? {} : { cursor }) },
        signal,
    }).then(({ items, nextCursor }) => ({ items: toActivityItems(items), nextCursor }));

type ActivityQuery = Query<
    GroupActivityPage,
    Error,
    GroupActivityData,
    ReturnType<typeof groupsKeys.activity>
>;

// As the dashboard feed: a focus/reconnect refetch of a stale feed is cut back to its first page
// first, so it is one request (the cut keeps the data's age and invalidation). Offline nothing is
// cut: the loaded pages stay readable until the network is back.
const trimBeforeRefetch = (query: ActivityQuery): boolean => {
    const { data, dataUpdatedAt, isInvalidated } = query.state;

    if (
        isNetworkUsable() &&
        data &&
        data.pages.length > 1 &&
        query.isStaleByTime(GROUP_DETAIL_STALE_TIME)
    ) {
        // `manual`: a paused fetch keeps its status.
        query.setData(firstGroupActivityPage(data), { updatedAt: dataUpdatedAt, manual: true });
        if (isInvalidated) {
            query.invalidate();
        }
    }
    return true;
};

/** A group's activity previews, newest first, by `nextCursor` until null. */
export const groupActivityQueryOptions = (groupId: string) =>
    infiniteQueryOptions({
        queryKey: groupsKeys.activity(groupId),
        staleTime: GROUP_DETAIL_STALE_TIME,
        initialPageParam: firstActivityPageParam(),
        queryFn: ({ pageParam, signal }) => fetchGroupActivityPage(groupId, pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
        // Pinned to TanStack Query 5.105: these callbacks run only in `onFocus`/`onOnline`, never
        // during render, so they may cut the cache (re-check on a TanStack upgrade).
        refetchOnWindowFocus: trimBeforeRefetch,
        refetchOnReconnect: trimBeforeRefetch,
    });

/**
 * The previews of all loaded pages, each parent once. Enable it once the detail is loaded: the
 * detail then has seeded the first page, and no second request is sent for it.
 */
export const useGroupActivityQuery = (groupId: string, { enabled }: EnabledParams) =>
    useInfiniteQuery({
        ...groupActivityQueryOptions(groupId),
        select: flattenGroupActivity,
        enabled,
    });
