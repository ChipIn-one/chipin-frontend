// A group's detail and activity for the UI (spec 03 §6 row 4). Like the groups list
// (`useGroupsList`), the queries send a request only while signed in and on the user's persisted
// client: signed out or on another client nothing is read.
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ActivityFeedItem, Group } from 'api/chipin.types';
import { isGroupDeniedError, useGroupActivityQuery, useGroupDetailQuery } from 'entities/groups';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { useGroupsList } from './useGroupsList';

const NO_ACTIVITY: ActivityFeedItem[] = [];

const useIsGroupQueryEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

export interface GroupDetailResult {
    /** The group: its detail, or the group as listed while the detail loads for the first time. */
    group: Group | undefined;
    /** No detail yet and no error: the group shown (if any) is the listed one. */
    isLoading: boolean;
    /** No detail, and the load failed or waits for the network (spec 03 §1.2, §1.8). */
    isError: boolean;
    /** The load failed with a 403/404: the user may not read the group. */
    isDenied: boolean;
}

/** The detail of `groupId` (none: nothing is read). */
export const useGroupDetail = (groupId: string | undefined): GroupDetailResult => {
    const isEnabled = useIsGroupQueryEnabled() && groupId !== undefined;
    const { groups } = useGroupsList();
    const listed = groupId === undefined ? undefined : groups?.find(item => item.id === groupId);
    const query = useGroupDetailQuery(groupId ?? '', { enabled: isEnabled, placeholder: listed });
    const group = isEnabled ? query.data : undefined;
    const hasDetail = group !== undefined && !query.isPlaceholderData;
    const isError = isEnabled && !hasDetail && (query.isError || query.isPaused);

    return {
        group,
        isLoading: groupId !== undefined && !hasDetail && !isError,
        isError,
        isDenied: isError && isGroupDeniedError(query.error),
    };
};

export interface GroupActivityResult {
    items: ActivityFeedItem[];
    hasMore: boolean;
    isNextPageLoading: boolean;
    isNextPageError: boolean;
    /** Loads the next page; a fetch running (a refetch replaces the pages) holds it. */
    loadMore: () => void;
}

/**
 * The activity of `groupId`, read once its detail is loaded (`hasDetail`): the detail seeds the
 * first page, so opening a group sends one request.
 */
export const useGroupActivity = (groupId: string, hasDetail: boolean): GroupActivityResult => {
    const isEnabled = useIsGroupQueryEnabled() && hasDetail;
    const query = useGroupActivityQuery(groupId, { enabled: isEnabled });
    const { fetchNextPage, isFetching } = query;
    const loadMore = useCallback(() => {
        if (isEnabled && !isFetching) {
            void fetchNextPage();
        }
    }, [fetchNextPage, isEnabled, isFetching]);

    return {
        items: (isEnabled ? query.data : undefined) ?? NO_ACTIVITY,
        hasMore: isEnabled && query.hasNextPage,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: query.isFetchNextPageError,
        loadMore,
    };
};
