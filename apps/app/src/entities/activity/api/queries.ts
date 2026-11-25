// The user's own activity (spec 03 §1.2, §6 row 5) under `['activity','self',filters]`: the
// previews of the dashboard feed and the flat log of the Activity page, 30 s fresh, infinite,
// persisted as their first page only (`trimmingPersister`), cut to it on unmount and before a
// focus/reconnect refetch only while the network is usable. Both come through `api()` as domain
// items (amounts as `Money`). `activityKeys.self()` invalidates every feed of the user. The history
// of one activity chain (the expense history page) is `['activity','children',parentId]`, 60 s.
import { useEffect } from 'react';
import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';
import { infiniteQueryOptions, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { api } from 'shared/api/client';
import { refetchIfRestored } from 'shared/api/queryClient';
import { isNetworkUsable } from 'shared/offline/network';

import { firstPageOnly } from '../model/selfActivity';
import {
    toActivityChildrenPage,
    toActivityItems,
    toActivityLogItems,
} from '../model/toActivityItem';
import type {
    ActivityChildrenPage,
    SelfActivityEventsPage,
    SelfActivityPreviewsPage,
} from '../model/types';

const SELF_ACTIVITY_STALE_TIME = 30_000;
const ACTIVITY_CHILDREN_STALE_TIME = 60_000;

/**
 * What a feed of the user's activity shows: `previews` are the active ledger chains (the
 * dashboard), `events` every event on its own (the Activity page; its expense/settlement filter
 * narrows the loaded events on the client, so it is not part of the key).
 */
export interface SelfActivityFilters {
    readonly view: 'previews' | 'events';
}

type SelfRootKey = readonly ['activity', 'self'];
type SelfFeedKey = readonly ['activity', 'self', SelfActivityFilters];

function selfKey(): SelfRootKey;
function selfKey(filters: SelfActivityFilters): SelfFeedKey;
function selfKey(filters?: SelfActivityFilters): SelfRootKey | SelfFeedKey {
    return filters === undefined ? ['activity', 'self'] : ['activity', 'self', filters];
}

export const activityKeys = {
    all: ['activity'] as const,
    /** One feed of the user's own activity; without filters, the root of all of them. */
    self: selfKey,
    /** The history of one activity chain, by the id of its creation event. */
    children: (parentActivityId: string) => ['activity', 'children', parentActivityId] as const,
};

// The first page has no cursor (a function: a typed constant would narrow to `null`).
const firstPageParam = (): number | null => null;

const pageQuery = (cursor: number | null) => ({
    limit: ACTIVITY_API_LIMIT,
    ...(cursor === null ? {} : { cursor }),
});

// `api()` rejects with an `ApiError`: a 5xx is retried, other 4xx are final. A `queryFn` here only
// returns its page: it writes no other query's cache.
const fetchPreviewsPage = (
    cursor: number | null,
    signal: AbortSignal,
): Promise<SelfActivityPreviewsPage> =>
    api('get', '/users/self/activity-previews', { query: pageQuery(cursor), signal }).then(
        ({ items, nextCursor }) => ({ items: toActivityItems(items), nextCursor }),
    );

const fetchEventsPage = (
    cursor: number | null,
    signal: AbortSignal,
): Promise<SelfActivityEventsPage> =>
    api('get', '/users/self/activities', { query: pageQuery(cursor), signal }).then(
        ({ items, nextCursor }) => ({ items: toActivityLogItems(items), nextCursor }),
    );

const fetchChildrenPage = (
    parentActivityId: string,
    cursor: number | null,
    signal: AbortSignal,
): Promise<ActivityChildrenPage> =>
    api('get', '/users/self/activities/{parentActivityId}/children', {
        params: { parentActivityId },
        query: pageQuery(cursor),
        signal,
    }).then(toActivityChildrenPage);

// A refetch of an infinite query reloads every loaded page in turn. A stale feed is cut back to
// its first page before a focus/reconnect refetch, so the refetch is one request. The cut keeps
// the data's age and invalidation, so whether it refetches does not change. Offline nothing is
// cut, neither here nor on unmount (`useTrimOnUnmount`): the loaded pages stay readable until the
// network is back (except after a ledger write that failed on a network drop:
// `invalidateSelfActivity` cuts at once).
type FeedQuery<P> = Query<P, Error, InfiniteData<P, number | null>, SelfFeedKey>;

const trimBeforeRefetch = <P>(query: FeedQuery<P>): boolean => {
    const { data, dataUpdatedAt, isInvalidated } = query.state;

    if (
        isNetworkUsable() &&
        data &&
        data.pages.length > 1 &&
        query.isStaleByTime(SELF_ACTIVITY_STALE_TIME)
    ) {
        // `manual`: a paused fetch keeps its status.
        query.setData(firstPageOnly(data), { updatedAt: dataUpdatedAt, manual: true });
        if (isInvalidated) {
            query.invalidate();
        }
    }
    return true;
};

// Not generic where TanStack reads it: the page type of the feed is inferred from its own.
const trimPreviewsBeforeRefetch = (query: FeedQuery<SelfActivityPreviewsPage>): boolean =>
    trimBeforeRefetch(query);

// The Activity page is read pages deep: a focus or a reconnect refetches (when stale) only a feed
// of at most one page. Deeper, the loaded pages and the scroll position stay as they are (the
// legacy store never refetched on focus); a write still invalidates the feed.
const refetchOnlyFirstPage = (query: FeedQuery<SelfActivityEventsPage>): boolean =>
    (query.state.data?.pages.length ?? 0) <= 1;

/** The user's activity previews, newest first: no cursor first, then by `nextCursor` until null. */
export const selfActivityPreviewsQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: activityKeys.self({ view: 'previews' }),
        staleTime: SELF_ACTIVITY_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchPreviewsPage(pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
        // Checked on TanStack Query 5.105 and 5.106: these callbacks run only in
        // `onFocus`/`onOnline`, never during render, so they may cut the cache (re-check on a
        // TanStack upgrade).
        refetchOnWindowFocus: trimPreviewsBeforeRefetch,
        refetchOnReconnect: trimPreviewsBeforeRefetch,
    });

/** The user's flat activity log, newest first: no cursor first, then by `nextCursor` until null. */
export const selfActivityEventsQueryOptions = () =>
    infiniteQueryOptions({
        queryKey: activityKeys.self({ view: 'events' }),
        staleTime: SELF_ACTIVITY_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchEventsPage(pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
        refetchOnWindowFocus: refetchOnlyFirstPage,
        refetchOnReconnect: refetchOnlyFirstPage,
    });

/** Cuts every cached feed of the user's activity to its first page, keeping its age. */
export const trimSelfActivity = (client: QueryClient): void => {
    const feeds = client.getQueriesData<InfiniteData<unknown, number | null>>({
        queryKey: activityKeys.self(),
    });

    for (const [queryKey, data] of feeds) {
        if (data && data.pages.length > 1) {
            client.setQueryData(queryKey, firstPageOnly(data), {
                updatedAt: client.getQueryState(queryKey)?.dataUpdatedAt,
            });
        }
    }
};

/**
 * After a change of the ledger or of the user's groups: every feed of the user's activity is cut
 * to its first page (one request for its refetch) and marked stale; a shown one reloads now, the
 * rest on their next mount. A running load may predate the change, so it is cancelled first
 * (`cancelRefetch` alone restarts it only when the entry has data). Never rejects.
 */
export const invalidateSelfActivity = (client: QueryClient): Promise<void> => {
    const queryKey = activityKeys.self();

    trimSelfActivity(client);
    return client
        .cancelQueries({ queryKey })
        .then(() => client.invalidateQueries({ queryKey }, { cancelRefetch: true }));
};

/**
 * The history of one activity chain, newest first: no cursor first, then by `nextCursor` until
 * null. A chain is short (an entry's edits), so a refetch reloading every loaded page is cheap.
 */
export const activityChildrenQueryOptions = (parentActivityId: string) =>
    infiniteQueryOptions({
        queryKey: activityKeys.children(parentActivityId),
        staleTime: ACTIVITY_CHILDREN_STALE_TIME,
        refetchOnMount: refetchIfRestored,
        initialPageParam: firstPageParam(),
        queryFn: ({ pageParam, signal }) => fetchChildrenPage(parentActivityId, pageParam, signal),
        getNextPageParam: lastPage => lastPage.nextCursor,
    });

/**
 * After a write to the chain's entry (or a failed one, which may have been applied): its history
 * is marked stale and reloads now if shown, keeping what it shows meanwhile. A running load may
 * predate the write, so it is cancelled first. Never rejects.
 */
export const invalidateActivityChildren = (
    client: QueryClient,
    parentActivityId: string,
): Promise<void> => {
    const queryKey = activityKeys.children(parentActivityId);

    return client
        .cancelQueries({ queryKey })
        .then(() => client.invalidateQueries({ queryKey }, { cancelRefetch: true }));
};

// When a feed's page unmounts, the feed is cut to its first page: the stale refetch of the next
// mount (`refetchOnMount` runs during render, it cannot cut) is then one request, not one per page
// loaded before. Offline it is not cut: the pages loaded before stay readable on the way back,
// as for a focus/reconnect (`trimBeforeRefetch`).
const useTrimOnUnmount = (): void => {
    const client = useQueryClient();

    useEffect(
        () => () => {
            if (isNetworkUsable()) {
                trimSelfActivity(client);
            }
        },
        [client],
    );
};

/** The previews feed of the dashboard page. */
export const useSelfActivityPreviewsQuery = () => {
    useTrimOnUnmount();
    return useInfiniteQuery(selfActivityPreviewsQueryOptions());
};

interface EnabledParams {
    /** False while signed out: nothing is requested without a session. */
    enabled: boolean;
}

/** The flat log of the Activity page. */
export const useSelfActivityEventsQuery = ({ enabled }: EnabledParams) => {
    useTrimOnUnmount();
    return useInfiniteQuery({ ...selfActivityEventsQueryOptions(), enabled });
};

/** The history of one activity chain (the expense history page). */
export const useActivityChildrenQuery = (parentActivityId: string, { enabled }: EnabledParams) =>
    useInfiniteQuery({ ...activityChildrenQueryOptions(parentActivityId), enabled });
