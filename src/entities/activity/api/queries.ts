// The user's own activity (spec 03 §1.2, §6 row 5) under `['activity','self',filters]`: the
// previews of the dashboard feed and the flat log of the Activity page, 30 s fresh, infinite,
// persisted as their first page only (`trimmingPersister`). Both come through `api()` as domain
// items (amounts as `Money`). `activityKeys.self()` invalidates every feed of the user.
import { useEffect } from 'react';
import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';
import { infiniteQueryOptions, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { api } from 'shared/api/client';
import { isNetworkUsable } from 'shared/offline/network';

import { firstPageOnly } from '../model/selfActivity';
import { toActivityItems, toActivityLogItems } from '../model/toActivityItem';
import type { SelfActivityEventsPage, SelfActivityPreviewsPage } from '../model/types';

const SELF_ACTIVITY_STALE_TIME = 30_000;

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

// A refetch of an infinite query reloads every loaded page in turn. A stale feed is cut back to
// its first page before a focus/reconnect refetch, so the refetch is one request. The cut keeps
// the data's age and invalidation, so whether it refetches does not change. Offline nothing is
// cut: the loaded pages stay readable until the network is back.
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

// When a feed's page unmounts, the feed is cut to its first page: the stale refetch of the next
// mount (`refetchOnMount` runs during render, it cannot cut) is then one request, not one per page
// loaded before.
const useTrimOnUnmount = (): void => {
    const client = useQueryClient();

    useEffect(
        () => () => {
            trimSelfActivity(client);
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
