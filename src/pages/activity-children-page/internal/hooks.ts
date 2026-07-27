import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useIntersectionObserver } from '@uidotdev/usehooks';

import type { AppEvent } from 'api/activity.types';
import { useActivityStore } from 'store/activityStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectActivityChildrenLoading,
    selectActivityChildrenNextPageLoading,
    selectLedgerEntryRemoving,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import {
    getActivityChildCategory,
    getActivityLedgerEntryId,
} from 'features/activity/selectors';

import * as helpers from './helpers';

type SentinelRef = ReturnType<typeof useIntersectionObserver>[0];

interface ActivityChildrenPageData {
    parentEvent?: AppEvent;
    childItems: AppEvent[];
    shouldShowSkeleton: boolean;
    isNextPageLoading: boolean;
    isDeletingEntry: boolean;
    canDeleteEntry: boolean;
    isEndOfFeed: boolean;
    sentinelRef: SentinelRef;
    onDeleteEntry: () => void;
}

export const useActivityChildrenPageData = (): ActivityChildrenPageData => {
    const { t } = useTranslation('activity');
    const location = useLocation();
    const { parentActivityId } = useParams<{ parentActivityId: string }>();
    const { items, childItems, childHasMore, childParentActivityId } = useActivityStore(
        useShallow(s => ({
            items: s.items,
            childItems: s.childItems,
            childHasMore: s.childHasMore,
            childParentActivityId: s.childParentActivityId,
        })),
    );
    const dashboardActivityItems = useDashboardStore(s => s.activityItems);
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(s => ({
            groups: s.groups,
            selectedGroup: s.selectedGroup,
        })),
    );
    const { fetchSetChildActivity, fetchMoreChildActivity, deleteLedgerEntry } =
        useActivityStore();
    const isLoading = useLoadingStore(selectActivityChildrenLoading);
    const isNextPageLoading = useLoadingStore(selectActivityChildrenNextPageLoading);
    const isDeletingEntry = useLoadingStore(selectLedgerEntryRemoving);

    const parentEvent =
        helpers.getRouteParentEvent(location.state, parentActivityId) ??
        helpers.findParentActivityEvent({
            parentActivityId,
            activityItems: items,
            dashboardActivityItems,
            selectedGroupActivities: selectedGroup?.recentActivities ?? [],
            groups,
        });
    const childCategory = getActivityChildCategory(parentEvent);
    const parentEntryId = getActivityLedgerEntryId(parentEvent);

    const isCurrentParentLoaded = childParentActivityId === parentActivityId;
    const shouldShowSkeleton = isLoading || !isCurrentParentLoaded;
    const isEndOfFeed = !isNextPageLoading && !childHasMore && childItems.length > 0;
    const [sentinelRef, sentinelEntry] = useIntersectionObserver({ threshold: 0 });

    useEffect(() => {
        if (!parentActivityId || isCurrentParentLoaded) {
            return;
        }

        fetchSetChildActivity({ parentActivityId, category: childCategory });
    }, [parentActivityId, childCategory, isCurrentParentLoaded, fetchSetChildActivity]);

    useEffect(() => {
        if (sentinelEntry?.isIntersecting && childHasMore && !isNextPageLoading) {
            fetchMoreChildActivity();
        }
    }, [
        sentinelEntry?.isIntersecting,
        childHasMore,
        isNextPageLoading,
        fetchMoreChildActivity,
    ]);

    const onDeleteEntry = () => {
        if (!parentActivityId || !parentEntryId) {
            return;
        }

        deleteLedgerEntry(parentEntryId)
            .then(() => {
                toast.success(t('toasts:ledger.entryDeleted'));
                fetchSetChildActivity({ parentActivityId, category: childCategory });
            })
            .catch(() => {
                toast.error(t('toasts:ledger.entryDeleteError'));
            });
    };

    return {
        parentEvent,
        childItems,
        shouldShowSkeleton,
        isNextPageLoading,
        isDeletingEntry,
        canDeleteEntry: Boolean(parentEntryId),
        isEndOfFeed,
        sentinelRef,
        onDeleteEntry,
    };
};
