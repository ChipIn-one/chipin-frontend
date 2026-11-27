import { useMemo } from 'react';
import { Button, Flex, Spinner, Text } from '@radix-ui/themes';
import { ChevronsDownIcon, RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import { useSelfActivityLog } from 'hooks/useSelfActivity';

import {
    EmptyState,
    NoActivityEmptyState,
    NoFilteredActivityEmptyState,
} from 'basics/empty-states';
import { useEmptyStateAddExpenseAction } from 'components/EmptyStateAddExpenseButton';
import { ActivityFeedSkeleton } from 'components/skeletons';

import type { ActivityFilter } from './ActivityHeader';
import { ActivityEventsList } from './components';

interface Props {
    activeFilter: ActivityFilter;
    /** Resets the type filter to All: the action of a filtered-out empty list (EXP-066). */
    onShowAll: () => void;
}

const ActivityList = ({ activeFilter, onShowAll }: Props) => {
    const { t } = useTranslation(['activity', 'errors']);
    const {
        events,
        isLoading,
        isError,
        isOffline,
        hasMore,
        loadedKey,
        isFetching,
        isNextPageLoading,
        isNextPageError,
        loadMore,
        reload,
    } = useSelfActivityLog();
    const addExpenseAction = useEmptyStateAddExpenseAction();

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
        loadedKey,
    });

    if (isLoading) {
        return <ActivityFeedSkeleton />;
    }

    // Nothing to show and the first load failed: an error with Retry, never "no activity".
    if (isError) {
        return (
            <EmptyState
                icon={<RefreshCwIcon size={20} />}
                title={t('loadErrorTitle')}
                description={t('loadErrorDescription')}
                action={
                    <Button type="button" variant="soft" onClick={reload}>
                        <RefreshCwIcon size={14} />
                        {t('retryAction')}
                    </Button>
                }
            />
        );
    }

    // Nothing cached and no network: the load resumes by itself on reconnect, so no Retry.
    if (isOffline) {
        return <EmptyState icon={<WifiOffIcon size={20} />} title={t('errors:network.offline')} />;
    }

    // A type filter that leaves nothing offers Show all (EXP-066); the unfiltered feed, Add Expense
    // (EXP-065).
    const emptyState =
        activeFilter === 'all' ? (
            <NoActivityEmptyState action={addExpenseAction} />
        ) : (
            <NoFilteredActivityEmptyState
                action={
                    <Button type="button" variant="soft" onClick={onShowAll}>
                        {t('showAllAction')}
                    </Button>
                }
            />
        );

    return (
        <>
            <ActivityEventsList
                log={filteredEvents}
                emptyState={emptyState}
                isFullActivityFeed
                isNavigable
            />

            {isNextPageLoading && (
                <Flex justify="center" py="4">
                    <Spinner size="3" />
                </Flex>
            )}

            {isNextPageError && (
                <Flex justify="center" py="4">
                    <Button type="button" size="1" variant="soft" onClick={loadMore}>
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

export { ActivityList };
