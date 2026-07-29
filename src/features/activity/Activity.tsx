import { useMemo, useState } from 'react';
import { LucideChevronsDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex, Spinner, Text } from '@radix-ui/themes';

import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import { selectActivityFeed, useActivityStore } from 'store/activity-store';
import { selectActivityLoading, selectActivityNextPageLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { ActivityFeedSkeleton } from 'components/skeletons';

import ActivityHeader, { ActivityFilter } from './ActivityHeader';
import { ActivityEventsList } from './components';

const Activity = () => {
    const { t } = useTranslation('activity');
    const { items, hasMore } = useActivityStore(useShallow(selectActivityFeed));
    const fetchMoreActivity = useActivityStore(s => s.fetchMoreActivity);
    const isLoading = useLoadingStore(selectActivityLoading);
    const isNextPageLoading = useLoadingStore(selectActivityNextPageLoading);

    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

    const filteredItems = useMemo(() => {
        if (activeFilter === 'expenses') {
            return items.filter(
                item =>
                    item.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
                    item.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED,
            );
        }

        if (activeFilter === 'settlements') {
            return items.filter(
                item =>
                    item.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED ||
                    item.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED,
            );
        }

        return items;
    }, [items, activeFilter]);

    const isEndOfFeed = !isNextPageLoading && !hasMore && items.length > 0;

    const sentinelRef = useInfiniteScroll({
        hasMore,
        isLoading: isNextPageLoading,
        onLoadMore: fetchMoreActivity,
    });

    return (
        <>
            <ActivityHeader
                isLoading={isLoading}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />

            {isLoading ? (
                <ActivityFeedSkeleton isShowSummary={false} />
            ) : (
                <ActivityEventsList
                    events={filteredItems}
                    isShowSummary={false}
                    isNavigable={false}
                >
                    <>
                        {isNextPageLoading && (
                            <Flex justify="center" py="4">
                                <Spinner size="3" />
                            </Flex>
                        )}

                        {isEndOfFeed && (
                            <Flex justify="center" align="center" gap="2" py="4">
                                <Text as="span" color="gray">
                                    <LucideChevronsDown size={14} />
                                </Text>
                                <Text size="1" color="gray">
                                    {t('endOfFeed')}
                                </Text>
                            </Flex>
                        )}

                        <div ref={sentinelRef} />
                    </>
                </ActivityEventsList>
            )}
        </>
    );
};

export default Activity;
