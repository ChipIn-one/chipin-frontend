// The groups entity (spec 03 §1.2, §6 row 4): the user's groups list (60 s fresh), a group's
// detail with its balances (30 s) and a group's activity previews (30 s, infinite), all persisted
// (the infinite ones as their first page only, `trimmingPersister`). All come through `api()` as
// domain models (`toGroup`, `toActivityItems`: amounts as `Money`). Every query function only reads
// its own resource (#669, `50-api-data.md` §Query Functions): the activity starts from the cached
// detail's page (`initialData`), and a denied group page reloads the list (a hook effect).
import { useEffect } from 'react';
import type {
    FetchStatus,
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
import { isNetworkUsable, runWhenOnline } from 'shared/offline/network';

import {
    firstActivityPageParam,
    firstGroupActivityPage,
    type GroupActivityData,
    selectGroupActivity,
} from '../model/groupActivity';
import { flattenGroupsList, type GroupsListData } from '../model/groupsList';
import { toGroup, toGroupsListPage } from '../model/toGroup';
import type { Group, GroupActivityPage, GroupsListPage } from '../model/types';

import { groupsKeys } from './keys';
import { reloadGroupsList } from './listCache';

export { groupsKeys };

export const GROUPS_LIST_STALE_TIME = 60_000;
export const GROUP_DETAIL_STALE_TIME = 30_000;

// The list's first page has no cursor (a function: a typed constant would narrow to `null`).
const firstPageParam = (): string | null => null;

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

// A pure read (#669): the group, or a rejection with an `ApiError`. It writes no other cache.
const fetchGroupDetail = (groupId: string, signal: AbortSignal): Promise<Group> =>
    api('get', '/groups/{id}', { params: { id: groupId }, signal }).then(
        toGroup,
        (error: unknown) => Promise.reject(toApiError(error)),
    );

/** A group with its members' balances; a 403/404 fails with an `ApiError` (never retried). */
export const groupDetailQueryOptions = (groupId: string) =>
    queryOptions({
        queryKey: groupsKeys.detail(groupId),
        staleTime: GROUP_DETAIL_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        enabled: isReadable,
        queryFn: ({ signal }) => fetchGroupDetail(groupId, signal),
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

// The denials whose list reload has started, per error object: every reader of a group page sees
// the same error, and its list reloads once.
const reloadedDenials = new WeakSet<object>();

// Per client and group, the detail `dataUpdatedAt` that last marked the list stale: every reader of
// a group page sees the same read, and it marks the list once.
const listMarkedStaleBy = new WeakMap<QueryClient, Map<string, number>>();

// A detail read newer than the cached list: the group's card in the list may show older balances,
// so the list is marked stale without a request (`refetchType: 'none'`); the next mount of a list
// reader reads it again. An invalidation from the reader of its own result, never an edit of the
// list (`50-api-data.md` §Query Functions). A group being left (`forgetGroup`) marks nothing.
const markListStaleAfterRead = (client: QueryClient, groupId: string, readAt: number): void => {
    const detail = client
        .getQueryCache()
        .find({ queryKey: groupsKeys.detail(groupId), exact: true });
    const listAt = client.getQueryState(groupsKeys.list())?.dataUpdatedAt;
    const marked = listMarkedStaleBy.get(client) ?? new Map<string, number>();

    if (!detail || leavingQueries.has(detail) || listAt === undefined || readAt <= listAt) {
        return;
    }
    if (marked.get(groupId) === readAt) {
        return;
    }
    marked.set(groupId, readAt);
    listMarkedStaleBy.set(client, marked);
    void client.invalidateQueries({ queryKey: groupsKeys.list(), refetchType: 'none' });
};

/**
 * No group (`undefined`): no query at all, not even an idle cache entry (the route has no group).
 * A denied read (403/404) reloads the groups list once per failed read (`reloadGroupsList`): the
 * server's list no longer has the group. A successful read newer than the list marks the list
 * stale, without a request (`markListStaleAfterRead`). The list data is never edited here.
 */
export const useGroupDetailQuery = (
    groupId: string | undefined,
    { enabled, placeholder }: GroupDetailQueryParams,
) => {
    const client = useQueryClient();
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

    const result = useQueries({ queries, combine: selectFirst });
    const denial =
        enabled && result?.isError === true && isGroupDeniedError(result.error)
            ? result.error
            : undefined;

    const readAt =
        enabled && result?.status === 'success' && !result.isPlaceholderData
            ? result.dataUpdatedAt
            : undefined;

    useEffect(() => {
        if (denial !== undefined && !reloadedDenials.has(denial)) {
            reloadedDenials.add(denial);
            void reloadGroupsList(client);
        }
    }, [client, denial]);
    useEffect(() => {
        if (groupId !== undefined && readAt !== undefined) {
            markListStaleAfterRead(client, groupId, readAt);
        }
    }, [client, groupId, readAt]);
    return result;
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

// Whether a group feed may be cut now: no reader shows it and no load runs (its answer would
// replace the cut).
const isIdleAndUnobserved = (feed: {
    getObserversCount: () => number;
    state: { fetchStatus: FetchStatus };
}): boolean => feed.getObserversCount() === 0 && feed.state.fetchStatus === 'idle';

// Once the network is back, every group feed that no page shows by then is cut to its first page,
// keeping its age (a feed mounted again meanwhile keeps its pages: its page reads them; one with a
// load running is left to it). The one online waiter of the client is shared with the user's own
// feeds (`runWhenOnline`).
const trimUnobservedGroupActivityWhenOnline = (client: QueryClient): void => {
    runWhenOnline(client, 'groups.activity.trim', () => {
        const feeds = client.getQueryCache().findAll({ queryKey: [...groupsKeys.all, 'activity'] });

        for (const feed of feeds) {
            // A load resumed by the reconnect is fetching here: it is skipped, not cut.
            if (isIdleAndUnobserved(feed)) {
                // Every entry under `['groups','activity']` is a group's infinite feed.
                cutToFirstPage(feed as unknown as ActivityQuery);
            }
        }
    });
};

// A refetch on mount is decided during render, where the cache must not change: a group's feed
// is cut back to its first page when its last reader unmounts instead, so the next mount's
// refetch is one request. Not while a load runs (its answer would replace the cut). Offline the
// pages stay readable: the feed is cut once the network is back, if no page shows it by then.
// Checked on TanStack Query 5.105–5.107.1: when the last observer leaves, a running load that
// read its signal is cancelled and its state reverted synchronously, so the feed is idle here
// (re-check on a TanStack upgrade).
const trimGroupActivityIfUnobserved = (client: QueryClient, groupId: string): void => {
    const feed = client.getQueryCache().find<GroupActivityPage, Error, GroupActivityData>({
        queryKey: groupsKeys.activity(groupId),
        exact: true,
    });

    if (!feed || feed.getObserversCount() > 0) {
        return;
    }
    if (!isNetworkUsable()) {
        trimUnobservedGroupActivityWhenOnline(client);
    } else if (isIdleAndUnobserved(feed)) {
        cutToFirstPage(feed);
    }
};

// The detail cached for the group, when its last read succeeded (a denied one seeds nothing) and
// the group is not being left (`forgetGroup`: its page is about to unmount).
const readableDetail = (client: QueryClient, groupId: string) => {
    const detail = client
        .getQueryCache()
        .find<Group>({ queryKey: groupsKeys.detail(groupId), exact: true });

    return detail && !leavingQueries.has(detail) && detail.state.status === 'success'
        ? detail.state
        : undefined;
};

// A read-side seed (`50-api-data.md` §Query Functions): the first activity page from the page the
// cached detail carries, as old as that detail, so opening a group sends one request (the detail).
// TanStack applies it only while the activity has no data (checked on 5.107.1: at creation and
// on each observer's options update), so cached or loaded activity always wins. A failed load of
// the activity keeps its error: the seed does not hide it.
const activityFromDetail = (
    client: QueryClient,
    groupId: string,
): GroupActivityData | undefined => {
    if (client.getQueryState(groupsKeys.activity(groupId))?.status === 'error') {
        return undefined;
    }
    const detail = readableDetail(client, groupId)?.data;

    return detail && { pages: [detail.recentActivities], pageParams: [firstActivityPageParam()] };
};

/**
 * A group's activity previews, newest first, by `nextCursor` until null. It starts from the first
 * page the detail cached on `client` carries (`activityFromDetail`).
 */
export const groupActivityQueryOptions = (groupId: string, client: QueryClient) =>
    infiniteQueryOptions({
        queryKey: groupsKeys.activity(groupId),
        staleTime: GROUP_DETAIL_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        initialData: () => activityFromDetail(client, groupId),
        initialDataUpdatedAt: () => readableDetail(client, groupId)?.dataUpdatedAt,
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
 * The previews of all loaded pages, each parent once, with the page count. Enable it once the
 * detail is loaded: the first page then starts from the cached detail, and no request is sent for it.
 */
export const useGroupActivityQuery = (groupId: string, { enabled }: EnabledParams) => {
    const client = useQueryClient();
    const query = useInfiniteQuery({
        ...groupActivityQueryOptions(groupId, client),
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
