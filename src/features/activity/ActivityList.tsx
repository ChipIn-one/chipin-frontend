import { useMemo } from 'react';
import { Button, Flex, Spinner, Text } from '@radix-ui/themes';
import { ChevronsDownIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import { useSelfActivityLog } from 'hooks/useSelfActivity';

import { ActivityFeedSkeleton } from 'components/skeletons';

import type { ActivityFilter } from './ActivityHeader';
import { ActivityEventsList } from './components';

interface Props {
    activeFilter: ActivityFilter;
}

const ActivityList = ({ activeFilter }: Props) => {
    const { t } = useTranslation('activity');
    const {
        events,
        isLoading,
        isError,
        hasMore,
        isFetching,
        isNextPageLoading,
        isNextPageError,
        loadMore,
        reload,
    } = useSelfActivityLog();

    const filteredEvents = useMemo(() => {
        if (activeFilter === 'expenses') {
            return events.filter(
                event =>
                    event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
                    event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED ||
                    event.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED,
            );
        }

        if (activeFilter === 'settlements') {
            return events.filter(
                event =>
                    event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED ||
                    event.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED,
            );
        }

        return events;
    }, [events, activeFilter]);

    const isEndOfFeed = !isNextPageLoading && !hasMore && events.length > 0;
    // Any fetch of the feed holds the next page: a refetch replaces the pages it would extend.
    const sentinelRef = useInfiniteScroll({
        hasMore: hasMore && !isNextPageError,
        isLoading: isFetching,
        onLoadMore: loadMore,
    });
    // A failed first load (nothing to show) reloads the feed; a failed next page loads it again.
    const onRetry = isError ? reload : loadMore;

    if (isLoading) {
        return <ActivityFeedSkeleton />;
    }

    return (
        <>
            <ActivityEventsList log={filteredEvents} isFullActivityFeed />

            {isNextPageLoading && (
                <Flex justify="center" py="4">
                    <Spinner size="3" />
                </Flex>
            )}

            {(isNextPageError || isError) && (
                <Flex justify="center" py="4">
                    <Button type="button" size="1" variant="soft" onClick={onRetry}>
                        <RefreshCwIcon size={14} />
                        {t('retryAction')}
                    </Button>
                </Flex>
            )}

            {isEndOfFeed && (
                <Flex justify="center" align="center" gap="2" py="4">
                    <Text as="span" color="gray">
                        <ChevronsDownIcon size={14} />
                    </Text>
                    <Text size="1" color="gray">
                        {t('endOfFeed')}
                    </Text>
                </Flex>
            )}

            <div ref={sentinelRef} />
        </>
    );
};

export default ActivityList;
