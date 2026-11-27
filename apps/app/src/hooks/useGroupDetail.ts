// A group's detail and activity for the UI (spec 03 §6 row 4). Like the groups list
// (`useGroupsList`), the queries send a request only while signed in and on the user's persisted
// client: signed out or on another client nothing is read.
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ActivityPreview } from 'entities/activity';
import {
    flattenGroupActivity,
    type Group,
    type GroupActivityPage,
    isGroupActivityLeaving,
    isGroupDeniedError,
    useGroupActivityQuery,
    useGroupDetailQuery,
} from 'entities/groups';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { selectCanReadUserCache } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { useGroupsList } from './useGroupsList';

const NO_ACTIVITY: ActivityPreview[] = [];

const useIsGroupQueryEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

// AUTH-077: the cached data stays selected while the session is expired (the page is hidden).
const useIsGroupCacheReadable = (): boolean => {
    const canRead = useAuthStore(selectCanReadUserCache);
    const isUserClient = isUserCacheClient(useQueryClient());

    return canRead && isUserClient;
};

export interface GroupDetailResult {
    /**
     * The group: its detail, else the group as listed (while the detail loads, waits for the
     * network or failed), never a group the user may not read.
     */
    group: Group | undefined;
    /** The detail is loaded (not the listed group standing in for it). */
    hasDetail: boolean;
    /** No detail yet, and it is still loading. */
    isLoading: boolean;
    /** The last read failed with a 403/404: the user may not read the group (cached data too). */
    isDenied: boolean;
    /** The read waits for the network: it resumes by itself on reconnect (no Retry). */
    isPaused: boolean;
    /** Reads the detail again (a failed first read's Retry); nothing while no read may be sent. */
    retry: () => void;
}

/** The detail of `groupId` (none: nothing is read). */
export const useGroupDetail = (groupId: string | undefined): GroupDetailResult => {
    const isEnabled = useIsGroupQueryEnabled() && groupId !== undefined;
    const isReadable = useIsGroupCacheReadable() && groupId !== undefined;
    const { groups } = useGroupsList();
    const listed = groupId === undefined ? undefined : groups?.find(item => item.id === groupId);
    const query = useGroupDetailQuery(groupId, { enabled: isEnabled, placeholder: listed });
    // A denial (403/404, not a 401 of an expired session) wins over the data TanStack keeps from
    // an earlier read.
    const isDenied = isReadable && query?.isError === true && isGroupDeniedError(query.error);
    const detail =
        isReadable && !isDenied && query?.isPlaceholderData !== true ? query?.data : undefined;
    const hasDetail = detail !== undefined;
    const isPaused = query?.isPaused === true;
    const isSettled = query?.isError === true || isPaused;
    const refetch = query?.refetch;
    const retry = useCallback(() => {
        if (isEnabled && refetch) {
            void refetch();
        }
    }, [isEnabled, refetch]);

    return {
        group: isReadable && !isDenied ? (detail ?? listed) : undefined,
        hasDetail,
        isLoading: groupId !== undefined && !hasDetail && !isDenied && !isSettled,
        isDenied,
        isPaused,
        retry,
    };
};

export interface GroupActivityResult {
    items: readonly ActivityPreview[];
    hasMore: boolean;
    /**
     * The loaded page count and the time the data landed: a change re-arms the scroll trigger
     * (`useInfiniteScroll`). The count covers a page load under a frozen clock, the time a
     * refetch that keeps the count.
     */
    loadedKey: string;
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
}

// The previews of the page a group carries (each parent once, invalid items left out).
const embeddedPreviews = (recent: GroupActivityPage): ActivityPreview[] =>
    flattenGroupActivity({ pages: [recent], pageParams: [null] });

/**
 * The activity of `groupId`, read once its detail is loaded (`hasDetail`): its first page starts
 * from the page the cached detail carries (`recent`), so opening a group sends one request.
 * Until the activity has data, `recent` (then the listed group's recent activity) is shown, without
 * more pages.
 */
export const useGroupActivity = (
    groupId: string,
    hasDetail: boolean,
    recent?: GroupActivityPage,
): GroupActivityResult => {
    const client = useQueryClient();
    const isEnabled = useIsGroupQueryEnabled() && hasDetail;
    const isReadable = useIsGroupCacheReadable() && hasDetail;
    const embedded = useMemo(() => recent && embeddedPreviews(recent), [recent]);
    const query = useGroupActivityQuery(groupId, { enabled: isEnabled });
    const { fetchNextPage } = query;
    // A paused load counts: starting another would cancel it, again and again while offline.
    const isFetching = query.fetchStatus !== 'idle';
    // A group just left reads nothing more: its page is about to unmount.
    const loadMore = useCallback(() => {
        if (isEnabled && !isFetching && !isGroupActivityLeaving(client, groupId)) {
            void fetchNextPage();
        }
    }, [client, fetchNextPage, groupId, isEnabled, isFetching]);
    const data = isReadable ? query.data : undefined;
    const items = data?.items;

    return {
        items: items ?? embedded ?? NO_ACTIVITY,
        hasMore: items !== undefined && query.hasNextPage,
        loadedKey: `${data?.pageCount ?? 0}:${data ? query.dataUpdatedAt : 0}`,
        isFetching: isEnabled && isFetching,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: query.isFetchNextPageError,
        loadMore,
    };
};
