import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Flex, Spinner, Text } from '@radix-ui/themes';
import {
    ChevronsDownIcon,
    CircleAlertIcon,
    ListTreeIcon,
    RefreshCwIcon,
    WifiOffIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ActivityEventsList } from 'features/activity';
import type { ActivityHistoryResult } from 'hooks/useActivityHistory';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';

import { EmptyState } from 'basics/empty-states';
import { ActivityFeedSkeleton } from 'components/skeletons';

interface Props {
    history: ActivityHistoryResult;
}

const ActivitySubeventsFeed = ({ history }: Props) => {
    const { t } = useTranslation(['activity', 'errors']);
    const {
        events,
        hasMore,
        loadedKey,
        isFetching,
        isLoading,
        isError,
        isOffline,
        isNextPageLoading,
        isNextPageError,
        loadMore,
        reload,
    } = history;
    const isEndOfFeed = !isNextPageLoading && !hasMore && events.length > 0;
    // Any fetch of the history holds the next page: a refetch replaces the pages it would extend.
    const sentinelRef = useInfiniteScroll({
        hasMore: hasMore && !isNextPageError,
        isLoading: isFetching,
        onLoadMore: loadMore,
        loadedKey,
    });

    // Nothing to show and the first load failed: an error with Retry, never "no history".
    if (isError) {
        return (
            <EmptyState
                icon={<CircleAlertIcon size={20} />}
                iconColor={PROP_COLOR.danger}
                title={t('subeventsLoadErrorTitle')}
                description={t('subeventsLoadErrorDescription')}
                action={
                    <Button type="button" size="1" variant="soft" onClick={reload}>
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

    if (isLoading) {
        return <ActivityFeedSkeleton />;
    }

    return (
        <ActivityEventsList
            log={events}
            emptyState={
                <EmptyState
                    icon={<ListTreeIcon size={20} />}
                    iconColor={PROP_COLOR.neutral}
                    title={t('subeventsEmptyTitle')}
                    description={t('subeventsEmptyDescription')}
                />
            }
        >
            <>
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
                        <Text as="span" color={PROP_COLOR.neutral}>
                            <ChevronsDownIcon size={14} />
                        </Text>
                        <Text size="1" color={PROP_COLOR.neutral}>
                            {t('endOfFeed')}
                        </Text>
                    </Flex>
                )}

                <div ref={sentinelRef} />
            </>
        </ActivityEventsList>
    );
};

export { ActivitySubeventsFeed };
