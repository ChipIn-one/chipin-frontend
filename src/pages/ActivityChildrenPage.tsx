import { useEffect } from 'react';
import { LucideChevronsDown, LucideListTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { Container, Flex, Spinner, Text } from '@radix-ui/themes';
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

import { EmptyState } from 'basics/empty-states';
import { MobileNavBar } from 'components/nav-bars';
import { ActivityChildrenEventsSkeleton, ActivityChildrenPageSkeleton } from 'components/skeletons';
import { ActivityChildrenHeader } from 'features/activity';
import { ActivityEventsList } from 'features/activity/components';
import {
    getActivityChildCategory,
    getActivityLedgerEntryId,
} from 'features/activity/selectors';

const findActivityEvent = (events: AppEvent[], activityId?: string): AppEvent | undefined => {
    return events.find(event => event.id === activityId);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const getRouteParentEvent = (
    state: unknown,
    activityId?: string,
): AppEvent | undefined => {
    if (!isRecord(state)) {
        return undefined;
    }

    const parentActivityEvent = state.parentActivityEvent;

    if (!isRecord(parentActivityEvent) || parentActivityEvent.id !== activityId) {
        return undefined;
    }

    return parentActivityEvent as AppEvent;
};

const ActivityChildrenPage = () => {
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
        getRouteParentEvent(location.state, parentActivityId) ??
        findActivityEvent(items, parentActivityId) ??
        findActivityEvent(dashboardActivityItems, parentActivityId) ??
        findActivityEvent(selectedGroup?.recentActivities ?? [], parentActivityId) ??
        groups.reduce<AppEvent | undefined>((foundEvent, group) => {
            if (foundEvent) {
                return foundEvent;
            }

            return findActivityEvent(group.recentActivities, parentActivityId);
        }, undefined);
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

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivityChildrenHeader
                parentEvent={parentEvent}
                isDeleting={isDeletingEntry}
                canDelete={Boolean(parentEntryId)}
                onDelete={onDeleteEntry}
            />

            {shouldShowSkeleton ? (
                parentEvent ? (
                    <ActivityChildrenEventsSkeleton />
                ) : (
                    <ActivityChildrenPageSkeleton />
                )
            ) : (
                <ActivityEventsList
                    events={childItems}
                    emptyState={
                        <EmptyState
                            icon={<LucideListTree size={16} />}
                            iconColor="gray"
                            title={t('childEmptyTitle')}
                            description={t('childEmptyDescription')}
                        />
                    }
                >
                    <>
                        {isNextPageLoading && (
                            <Flex justify="center" py="4">
                                <Spinner size="3" />
                            </Flex>
                        )}

                        {isEndOfFeed && (
                            <Flex justify="center" align="center" gap="2" py="4">
                                <LucideChevronsDown size={14} color="var(--gray-8)" />
                                <Text size="1" color="gray">
                                    {t('endOfFeed')}
                                </Text>
                            </Flex>
                        )}

                        <div ref={sentinelRef} />
                    </>
                </ActivityEventsList>
            )}

            <MobileNavBar />
        </Container>
    );
};

export default ActivityChildrenPage;
