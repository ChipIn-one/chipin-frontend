// The groups entity (spec 03 §1.2, §6 row 4): the user's groups list (60 s fresh), a group's
// detail with its balances (30 s) and a group's activity previews (30 s, infinite), all persisted
// (the infinite ones as their first page only, `trimmingPersister`). All come through `api()` as
// domain models (`toGroup`, `toActivityItems`: amounts as `Money`).
import { useEffect } from 'react';
import type {
    Query,
    QueryClient,
    QueryKey,
    UseQueryOptions,
    UseQueryResult,
} from '@tanstack/react-query';
import {
    infiniteQueryOptions,
    queryOptions,
    useInfiniteQuery,
    useQueries,
    useQueryClient,
} from '@tanstack/react-query';

import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { toActivityItems } from 'entities/activity';
import { api, ApiError, toApiError } from 'shared/api/client';
import { refetchIfRestored } from 'shared/api/queryClient';
import { isNetworkUsable } from 'shared/offline/network';

import {
    firstGroupActivityPage,
    type GroupActivityData,
    selectGroupActivity,
} from '../model/groupActivity';
import { flattenGroupsList, type GroupsListData } from '../model/groupsList';
import { toGroup, toGroupsListPage } from '../model/toGroup';
import type { Group, GroupActivityPage, GroupsListPage } from '../model/types';

import { groupsKeys } from './keys';
import { dropGroupFromCachedList, putGroupInCachedList } from './listCache';

export { groupsKeys };

export const GROUPS_LIST_STALE_TIME = 60_000;
export const GROUP_DETAIL_STALE_TIME = 30_000;

// The first page has no cursor (functions: a typed constant would narrow to `null`).
const firstPageParam = (): string | null => null;
const firstActivityPageParam = (): number | null => null;

// `api()` rejects with an `ApiError`: a 5xx is retried, other 4xx are final.
const fetchGroupsPage = (cursor: string | null, signal: AbortSignal): Promise<GroupsListPage> =>
    api('get', '/groups', { query: cursor === null ? {} : { cursor }, signal }).then(
        toGroupsListPage,
    );

/**
 * The groups, newest first: the first page without a cursor, then by `nextCursor` until null. The
 * readers load the first page only (as the legacy store did); a refetch reloads what is loaded.
 */
export const groupsListQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: groupsKeys.list(),
        staleTime: GROUPS_LIST_STALE_TIME,
        refetchOnMount: refetchIfRestored,
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

// The detail and activity queries of a group the user just removed or left, until the page still
// showing them unmounts (`forgetGroup`): their observers are disabled meanwhile, so a focus, a
// reconnect or an invalidation does not read a group that is gone (a 404 flash). Per query object,
// so another client's queries (an account switch) are never affected.
const leavingQueries = new WeakSet<object>();

/** Marks (or unmarks) a cached group query as leaving: no observer reads it while marked. */
export const setGroupQueryLeaving = (query: object, isLeaving: boolean): void => {
    if (isLeaving) {
        leavingQueries.add(query);
    } else {
        leavingQueries.delete(query);
    }
};

export const isGroupQueryLeaving = (query: object): boolean => leavingQueries.has(query);

// The `enabled` of every group detail and activity observer.
const isReadable = (query: object): boolean => !leavingQueries.has(query);

/** Whether a failed detail read means the user may not read the group (not a member, removed). */
export const isGroupDeniedError = (error: unknown): boolean =>
    error instanceof ApiError && (error.status === 403 || error.status === 404);

/**
 * Seeds the first page of a group's activity from the page its detail read carries, when the
 * activity has nothing cached and is not loading, so opening a group sends one request. A seed
 * never replaces cached or loading activity (a newer read wins). It is as old as the detail read
 * that carried it (`updatedAt`, when the read was sent).
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

// A group read keeps the cached list current (03-10a race rules, `putGroupInCachedList`) and seeds
// the first page of its activity (`seedGroupActivity`, as old as the read), and a denied read drops
// the group from the list. A cancelled read writes nothing, not even a denial: a write confirmed
// meanwhile (an edit, a rejoin) is newer.
const fetchGroupDetail = (
    client: QueryClient,
    groupId: string,
    signal: AbortSignal,
): Promise<Group> => {
    const readStartedAt = Date.now();

    return api('get', '/groups/{id}', { params: { id: groupId }, signal }).then(
        response => {
            const group = toGroup(response);

            if (!signal.aborted) {
                seedGroupActivity(client, groupId, group.recentActivities, readStartedAt);
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
        refetchOnMount: refetchIfRestored,
        enabled: isReadable,
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
            : [
                  {
                      ...groupDetailQueryOptions(groupId),
                      enabled: enabled ? isReadable : false,
                      placeholderData: placeholder,
                  },
              ];

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

// Cuts a feed to its first page, keeping the data's age and invalidation (whether it refetches
// does not change). `manual`: a paused fetch keeps its status.
const cutToFirstPage = <K extends QueryKey>(
    query: Query<GroupActivityPage, Error, GroupActivityData, K>,
): void => {
    const { data, dataUpdatedAt, isInvalidated } = query.state;

    if (data && data.pages.length > 1) {
        query.setData(firstGroupActivityPage(data), { updatedAt: dataUpdatedAt, manual: true });
        if (isInvalidated) {
            query.invalidate();
        }
    }
};

// As the dashboard feed: a focus/reconnect refetch of a stale feed is cut back to its first page
// first, so it is one request. Offline nothing is cut: the loaded pages stay readable until the
// network is back.
const trimBeforeRefetch = (query: ActivityQuery): boolean => {
    if (isNetworkUsable() && query.isStaleByTime(GROUP_DETAIL_STALE_TIME)) {
        cutToFirstPage(query);
    }
    return true;
};

// A refetch on mount is decided during render, where the cache must not change: a group's feed
// is cut back to its first page when its last reader unmounts instead, so the next mount's
// refetch is one request. Not while a load runs (its answer would replace the cut) and not
// offline (the pages stay readable). Checked on TanStack Query 5.105–5.107.1: when the last
// observer leaves, a running load that read its signal is cancelled and its state reverted
// synchronously, so the feed is idle here (re-check on a TanStack upgrade).
const trimGroupActivityIfUnobserved = (client: QueryClient, groupId: string): void => {
    const feed = client.getQueryCache().find<GroupActivityPage, Error, GroupActivityData>({
        queryKey: groupsKeys.activity(groupId),
        exact: true,
    });

    if (
        feed &&
        isNetworkUsable() &&
        feed.getObserversCount() === 0 &&
        feed.state.fetchStatus === 'idle'
    ) {
        cutToFirstPage(feed);
    }
};

/** A group's activity previews, newest first, by `nextCursor` until null. */
export const groupActivityQueryOptions = (groupId: string) =>
    infiniteQueryOptions({
        queryKey: groupsKeys.activity(groupId),
        staleTime: GROUP_DETAIL_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        initialPageParam: firstActivityPageParam(),
        enabled: isReadable,
        queryFn: ({ pageParam, signal }) => fetchGroupActivityPage(groupId, pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
        // Checked on TanStack Query 5.105–5.107.1: these callbacks run only in
        // `onFocus`/`onOnline`, never during render, so they may cut the cache (re-check on a
        // TanStack upgrade).
        refetchOnWindowFocus: trimBeforeRefetch,
        refetchOnReconnect: trimBeforeRefetch,
    });

/**
 * The previews of all loaded pages, each parent once, with the page count. Enable it once the detail is loaded: the
 * detail then has seeded the first page, and no second request is sent for it.
 */
export const useGroupActivityQuery = (groupId: string, { enabled }: EnabledParams) => {
    const client = useQueryClient();
    const query = useInfiniteQuery({
        ...groupActivityQueryOptions(groupId),
        select: selectGroupActivity,
        enabled: enabled ? isReadable : false,
    });

    // Checked a microtask later, whatever the order of React's effects: by then the observer has
    // left this feed, on unmount and when the page moves to another group (`setOptions`).
    useEffect(
        () => () => {
            queueMicrotask(() => {
                trimGroupActivityIfUnobserved(client, groupId);
            });
        },
        [client, groupId],
    );
    return query;
};

/** Whether the group's activity belongs to a group just left (nothing loads it until unmount). */
export const isGroupActivityLeaving = (client: QueryClient, groupId: string): boolean => {
    const query = client.getQueryCache().find({
        queryKey: groupsKeys.activity(groupId),
        exact: true,
    });

    return query !== undefined && leavingQueries.has(query);
};
