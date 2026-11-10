// A group's detail and activity for the UI (spec 03 §6 row 4). Like the groups list
// (`useGroupsList`), the queries send a request only while signed in and on the user's persisted
// client: signed out or on another client nothing is read.
import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Group } from 'api/chipin.types';
import type { ActivityPreview } from 'entities/activity';
import { legacyActivityPreview } from 'entities/balance';
import {
    type GroupActivityPage,
    groupsKeys,
    isGroupDeniedError,
    seedGroupActivity,
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
    /** Any load runs (a refetch or the next page): a scroll trigger waits for it to end. */
    isFetching: boolean;
    isNextPageLoading: boolean;
    isNextPageError: boolean;
    /** Loads the next page; a fetch running (a refetch replaces the pages) holds it. */
    loadMore: () => void;
}

// LEGACY until 03-10c: the group (detail or listed) still comes through the legacy `src/api` layer,
// so the activity page it carries has number amounts; the legacy bridge carries it into the domain.
const toEmbeddedPage = (
    recent: Group['recentActivities'],
): GroupActivityPage & { items: ActivityPreview[] } => ({
    items: recent.items.map(legacyActivityPreview),
    nextCursor: recent.nextCursor,
});

/**
 * The activity of `groupId`, read once its detail is loaded (`hasDetail`): the page the detail
 * carries (`recent`) seeds the first page, so opening a group sends one request. Until the
 * activity has data, `recent` (then the listed group's recent activity) is shown, without more
 * pages.
 */
export const useGroupActivity = (
    groupId: string,
    hasDetail: boolean,
    recent?: Group['recentActivities'],
): GroupActivityResult => {
    const client = useQueryClient();
    const isEnabled = useIsGroupQueryEnabled() && hasDetail;
    const embedded = useMemo(() => recent && toEmbeddedPage(recent), [recent]);

    // Declared before the query: React runs effects in order, so the seed lands before the
    // enabled query decides whether to fetch its first page. The seed keeps the age of the detail
    // read that carried it (a detail restored from the cache gives a stale seed, then a fetch).
    useEffect(() => {
        const detailUpdatedAt = client.getQueryState(groupsKeys.detail(groupId))?.dataUpdatedAt;

        if (isEnabled && embedded && detailUpdatedAt) {
            seedGroupActivity(client, groupId, embedded, detailUpdatedAt);
        }
    }, [client, embedded, groupId, isEnabled]);

    const query = useGroupActivityQuery(groupId, { enabled: isEnabled });
    const { fetchNextPage, isFetching } = query;
    const loadMore = useCallback(() => {
        if (isEnabled && !isFetching) {
            void fetchNextPage();
        }
    }, [fetchNextPage, isEnabled, isFetching]);
    const items = isEnabled ? query.data : undefined;

    return {
        items: items ?? embedded?.items ?? NO_ACTIVITY,
        hasMore: items !== undefined && query.hasNextPage,
        isFetching: isEnabled && isFetching,
        isNextPageLoading: query.isFetchingNextPage,
        isNextPageError: query.isFetchNextPageError,
        loadMore,
    };
};
