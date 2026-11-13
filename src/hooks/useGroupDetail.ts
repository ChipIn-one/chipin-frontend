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
    isGroupDeniedError,
    useGroupActivityQuery,
    useGroupDetailQuery,
} from 'entities/groups';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { useGroupsList } from './useGroupsList';

const NO_ACTIVITY: ActivityPreview[] = [];

const useIsGroupQueryEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
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
}

/** The detail of `groupId` (none: nothing is read). */
export const useGroupDetail = (groupId: string | undefined): GroupDetailResult => {
    const isEnabled = useIsGroupQueryEnabled() && groupId !== undefined;
    const { groups } = useGroupsList();
    const listed = groupId === undefined ? undefined : groups?.find(item => item.id === groupId);
    const query = useGroupDetailQuery(groupId, { enabled: isEnabled, placeholder: listed });
    // A denial wins over the data TanStack keeps from an earlier read.
    const isDenied = isEnabled && query?.isError === true && isGroupDeniedError(query.error);
    const detail =
        isEnabled && !isDenied && query?.isPlaceholderData !== true ? query?.data : undefined;
    const hasDetail = detail !== undefined;
    const isSettled = query?.isError === true || query?.isPaused === true;

    return {
        group: isEnabled && !isDenied ? (detail ?? listed) : undefined,
        hasDetail,
        isLoading: groupId !== undefined && !hasDetail && !isDenied && !isSettled,
        isDenied,
    };
};

export interface GroupActivityResult {
    items: readonly ActivityPreview[];
    hasMore: boolean;
    /**
     * Changes whenever a page was loaded (the load time and the item count: the flattened items
     * carry no page count): it re-arms the scroll trigger (`useInfiniteScroll`).
     */
    loadedKey: string;
    /** Any load runs (a refetch or the next page): a scroll trigger waits for it to end. */
    isFetching: boolean;
    isNextPageLoading: boolean;
    isNextPageError: boolean;
    /** Loads the next page; a fetch running (a refetch replaces the pages) holds it. */
    loadMore: () => void;
}

// The previews of the page a group carries (each parent once, invalid items left out).
const embeddedPreviews = (recent: GroupActivityPage): ActivityPreview[] =>
    flattenGroupActivity({ pages: [recent], pageParams: [null] });

/**
 * The activity of `groupId`, read once its detail is loaded (`hasDetail`): the detail read has
 * seeded the first page with the page it carries (`recent`), so opening a group sends one request.
 * Until the activity has data, `recent` (then the listed group's recent activity) is shown, without
 * more pages.
 */
export const useGroupActivity = (
    groupId: string,
    hasDetail: boolean,
    recent?: GroupActivityPage,
): GroupActivityResult => {
    const isEnabled = useIsGroupQueryEnabled() && hasDetail;
    const embedded = useMemo(() => recent && embeddedPreviews(recent), [recent]);
    const query = useGroupActivityQuery(groupId, { enabled: isEnabled });
    const { fetchNextPage, isFetching } = query;
    const loadMore = useCallback(() => {
        if (isEnabled && !isFetching) {
            void fetchNextPage();
        }
    }, [fetchNextPage, isEnabled, isFetching]);
    const items = isEnabled ? query.data : undefined;

    return {
        items: items ?? embedded ?? NO_ACTIVITY,
        hasMore: items !== undefined && query.hasNextPage,
        loadedKey: `${String(query.dataUpdatedAt)}:${String(items?.length ?? 0)}`,
        isFetching: isEnabled && isFetching,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: query.isFetchNextPageError,
        loadMore,
    };
};
