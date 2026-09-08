import { useCallback, useEffect } from 'react';
import {
    LucideChevronsDown,
    LucideCircleAlert,
    LucideListTree,
    LucideRefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, Spinner, Text } from '@radix-ui/themes';

import type { ActivityCategory } from 'constants/activity';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import {
    selectActivitySubeventsError,
    selectActivitySubeventsNextPageError,
} from 'store/errorsSelectors';
import { useErrorsStore } from 'store/errorsStore';

import { EmptyState } from 'basics/empty-states';
import { ActivityFeedSkeleton } from 'components/skeletons';
import { ActivityEventsList } from 'features/activity';

import { useConnect } from './internal';

interface Props {
    parentActivityId?: string;
    activityCategory?: ActivityCategory;
}

const ActivitySubeventsFeed = ({
    parentActivityId,
    activityCategory,
}: Props) => {
    const { t } = useTranslation('activity');
    const {
        subevents,
        hasMoreSubevents,
        subeventsParent,
        fetchSetActivitySubevents,
        fetchMoreActivitySubevents,
        isLoading,
        isNextPageLoading,
    } = useConnect();
    const subeventsError = useErrorsStore(selectActivitySubeventsError);
    const isNextPageError = useErrorsStore(selectActivitySubeventsNextPageError) !== null;
    const isCurrentParentLoaded = subeventsParent?.id === parentActivityId;
    const isLoadError = subeventsError !== null;
    const shouldShowSkeleton = isLoading || !isCurrentParentLoaded;
    const isEndOfFeed =
        !isNextPageLoading &&
        !hasMoreSubevents &&
        subevents.length > 0;
    const onLoadMore = useCallback(() => {
        return fetchMoreActivitySubevents();
    }, [fetchMoreActivitySubevents]);
    const sentinelRef = useInfiniteScroll({
        hasMore: hasMoreSubevents && !isNextPageError,
        isLoading: isNextPageLoading,
        onLoadMore,
    });

    useEffect(() => {
        if (
            !parentActivityId ||
            isCurrentParentLoaded
        ) {
            return;
        }

        fetchSetActivitySubevents({
            parentActivityId,
            category: activityCategory,
        });
    }, [
        parentActivityId,
        activityCategory,
        isCurrentParentLoaded,
        fetchSetActivitySubevents,
    ]);

    const onRetry = () => {
        if (!parentActivityId) {
            return;
        }

        fetchSetActivitySubevents({
            parentActivityId,
            category: activityCategory,
        });
    };

    const onRetryNextPage = () => {
        onLoadMore();
    };

    if (isLoadError) {
        return (
            <EmptyState
                icon={<LucideCircleAlert size={16} />}
                iconColor="red"
                title={t('subeventsLoadErrorTitle')}
                description={t('subeventsLoadErrorDescription')}
                action={
                    <Button
                        type="button"
                        size="1"
                        variant="soft"
                        onClick={onRetry}
                    >
                        <LucideRefreshCw size={14} />
                        {t('retryAction')}
                    </Button>
                }
            />
        );
    }

    if (shouldShowSkeleton) {
        return <ActivityFeedSkeleton />;
    }

    return (
        <ActivityEventsList
            events={subevents}
            emptyState={
                <EmptyState
                    icon={<LucideListTree size={16} />}
                    iconColor="gray"
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
                        <Button
                            type="button"
                            size="1"
                            variant="soft"
                            onClick={onRetryNextPage}
                        >
                            <LucideRefreshCw size={14} />
                            {t('retryAction')}
                        </Button>
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
    );
};

export { ActivitySubeventsFeed };
