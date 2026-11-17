// The history of one activity chain for the expense history page (spec 03 §6 row 5, 12c): its
// creation event and later events, read from the `activity.children` query. Like the Activity page
// log (`useSelfActivityLog`), the query sends a request only while signed in and on the user's
// persisted client: signed out or on another client nothing is read.
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
    type ActivityEvent,
    loadedActivityChildren,
    useActivityChildrenQuery,
} from 'entities/activity';
import { isGroupDeniedError } from 'entities/groups';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

export interface ActivityHistoryResult {
    /** The chain's creation event; undefined until loaded, or when it cannot be shown. */
    parent: ActivityEvent | undefined;
    /** The later events of all loaded pages, newest first; empty until the first load. */
    events: readonly ActivityEvent[];
    /** Nothing cached yet and the first load is pending. */
    isLoading: boolean;
    /**
     * The first load failed with nothing cached (a chain that does not exist, too), or the last
     * load was denied (403/404): then the cached events are not shown either.
     */
    isError: boolean;
    /** The first load waits for the network (offline) with nothing cached. */
    isOffline: boolean;
    /** A loaded later event is unreadable: the shown state may be stale, no edit or delete. */
    hasInvalidEvents: boolean;
    hasMore: boolean;
    /** The loaded page count and the time the data landed: re-arms the scroll trigger. */
    loadedKey: string;
    /** A load runs or waits for the network: a scroll trigger waits for it to end. */
    isFetching: boolean;
    /** The next page is being requested (not while it waits for the network). */
    isNextPageLoading: boolean;
    isNextPageError: boolean;
    /** Loads the next page; a fetch running (a refetch replaces the pages) holds it. */
    loadMore: () => void;
    /** Loads the history again after a failed first load. */
    reload: () => void;
}

export const useActivityHistory = (parentActivityId: string | undefined): ActivityHistoryResult => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isEnabled =
        isUserCacheClient(useQueryClient()) && isSignedIn && parentActivityId !== undefined;
    const query = useActivityChildrenQuery(parentActivityId ?? '', { enabled: isEnabled });
    const { fetchNextPage, refetch } = query;
    // A paused load counts: starting another would cancel it, again and again while offline.
    const isFetching = query.fetchStatus !== 'idle';
    // A 403/404 (removed from the group, the expense's group deleted) wins over cached data, as
    // for `groups.detail`: stale events with working Edit/Delete must not be shown.
    const isDenied = query.isError && isGroupDeniedError(query.error);
    const data = isEnabled && !isDenied ? query.data : undefined;
    const { parent, events, hasInvalidEvents } = useMemo(
        () => loadedActivityChildren(data),
        [data],
    );
    const isWaiting = isEnabled && data === undefined;
    // A load paused offline is not a failure: Retry could not send it either.
    const isOffline = isWaiting && query.isPaused;
    const isError = isWaiting && query.isError && !isOffline;
    const loadMore = useCallback(() => {
        if (isEnabled && !isFetching) {
            void fetchNextPage();
        }
    }, [fetchNextPage, isEnabled, isFetching]);
    const reload = useCallback(() => {
        if (isEnabled) {
            void refetch();
        }
    }, [isEnabled, refetch]);

    return {
        parent,
        events,
        // Signed in on the anonymous client (before the remount onto the user's client) the
        // history is still to come: loading, never read from that client.
        isLoading:
            isSignedIn &&
            parentActivityId !== undefined &&
            data === undefined &&
            !isError &&
            !isOffline,
        isError,
        isOffline,
        hasInvalidEvents,
        hasMore: data !== undefined && query.hasNextPage,
        loadedKey: `${data?.pages.length ?? 0}:${data ? query.dataUpdatedAt : 0}`,
        isFetching: isEnabled && isFetching,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: data !== undefined && query.isFetchNextPageError,
        loadMore,
        reload,
    };
};
