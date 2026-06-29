import { useEffect, useMemo, useState } from 'react';
import { LucideChevronsDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex, Spinner, Text } from '@radix-ui/themes';
import { useIntersectionObserver } from '@uidotdev/usehooks';

import { useActivityStore } from 'store/activityStore';
import { selectActivityLoading, selectActivityNextPageLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { ActivityFeedSkeleton } from 'components/skeletons';

import ActivityHeader, { ActivityFilter } from './ActivityHeader';
import { ActivityEventsList } from './components';

const Activity = () => {
    const { t } = useTranslation('activity');
    const { items, hasMore } = useActivityStore(
        useShallow(s => ({ items: s.items, hasMore: s.hasMore })),
    );
    const { fetchMoreActivity: fetchAppendActivity } = useActivityStore();
    const isLoading = useLoadingStore(selectActivityLoading);
    const isNextPageLoading = useLoadingStore(selectActivityNextPageLoading);

    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

    const filteredItems = useMemo(() => {
        if (activeFilter === 'expenses') {
            return items.filter(item => item.action === 'EXPENSE_CREATED');
        }

        if (activeFilter === 'settlements') {
            return items.filter(item => item.action === 'SETTLEMENT_CREATED');
        }

        return items;
    }, [items, activeFilter]);

    const isEndOfFeed = !isNextPageLoading && !hasMore && items.length > 0;

    const [sentinelRef, sentinelEntry] = useIntersectionObserver({ threshold: 0 });

    useEffect(() => {
        if (sentinelEntry?.isIntersecting && hasMore && !isNextPageLoading) {
            fetchAppendActivity();
        }
    }, [sentinelEntry?.isIntersecting, hasMore, isNextPageLoading, fetchAppendActivity]);

    return (
        <>
            <ActivityHeader
                isLoading={isLoading}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />

            {isLoading ? (
                <ActivityFeedSkeleton />
            ) : (
                <ActivityEventsList events={filteredItems}>
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
        </>
    );
};

export default Activity;
