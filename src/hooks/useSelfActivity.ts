// The user's flat activity log for the Activity page (spec 03 §6 row 5). Like the friends
// (`useKnownUsers`), the query sends a request only while signed in and on the user's persisted
// client: signed out or on another client nothing is read.
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
    type ActivityEvent,
    loadedActivityEvents,
    useSelfActivityEventsQuery,
} from 'entities/activity';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

const NO_EVENTS: ActivityEvent[] = [];

export interface SelfActivityLogResult {
    /** The events of all loaded pages, newest first; empty until the first load. */
    events: readonly ActivityEvent[];
    /** Nothing cached yet and the first load is pending. */
    isLoading: boolean;
    /** The first load failed with nothing cached. */
    isError: boolean;
    /** The first load waits for the network (offline) with nothing cached. */
    isOffline: boolean;
    hasMore: boolean;
    /** How many pages are loaded: a change re-arms the scroll trigger (`useInfiniteScroll`). */
    loadedPages: number;
    /**
     * A load runs or waits for the network (a refetch or the next page): a scroll trigger waits
     * for it to end. A load paused offline resumes by itself on reconnect.
     */
    isFetching: boolean;
    /** The next page is being requested (not while it waits for the network). */
    isNextPageLoading: boolean;
    isNextPageError: boolean;
    /** Loads the next page; a fetch running (a refetch replaces the pages) holds it. */
    loadMore: () => void;
    /** Loads the feed again after a failed first load. */
    reload: () => void;
}

export const useSelfActivityLog = (): SelfActivityLogResult => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isEnabled = isUserCacheClient(useQueryClient()) && isSignedIn;
    const query = useSelfActivityEventsQuery({ enabled: isEnabled });
    const { fetchNextPage, refetch } = query;
    // A paused load counts: starting another would cancel it, again and again while offline.
    const isFetching = query.fetchStatus !== 'idle';
    const data = isEnabled ? query.data : undefined;
    const events = useMemo(() => (data ? loadedActivityEvents(data) : NO_EVENTS), [data]);
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
        events,
        // Signed in on the anonymous client (before the remount onto the user's client) the feed
        // is still to come: loading, never read from that client.
        isLoading: isSignedIn && data === undefined && !isError && !isOffline,
        isError,
        isOffline,
        hasMore: data !== undefined && query.hasNextPage,
        loadedPages: data?.pages.length ?? 0,
        isFetching: isEnabled && isFetching,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: data !== undefined && query.isFetchNextPageError,
        loadMore,
        reload,
    };
};
