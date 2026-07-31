import { useCallback, useEffect, useState } from 'react';
import {
    LucideChevronsDown,
    LucideCircleAlert,
    LucideListTree,
    LucideRefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Spinner, Text } from '@radix-ui/themes';

import type { ActivityCategory } from 'constants/activity';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import {
    selectActivitySubeventsFlow,
    useActivityStore,
} from 'store/activity-store';
import {
    selectActivitySubeventsLoading,
    selectActivitySubeventsNextPageLoading,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { EmptyState } from 'basics/empty-states';
import { ActivityFeedSkeleton } from 'components/skeletons';
import { ActivityEventsList } from 'features/activity';

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
        subeventsParentId,
        fetchSetActivitySubevents,
        fetchMoreActivitySubevents,
    } = useActivityStore(
        useShallow(selectActivitySubeventsFlow),
    );
    const isLoading = useLoadingStore(selectActivitySubeventsLoading);
    const isNextPageLoading = useLoadingStore(selectActivitySubeventsNextPageLoading);
    const [failedParentId, setFailedParentId] = useState<string | null>(null);
    const [isNextPageError, setIsNextPageError] = useState(false);
    const isCurrentParentLoaded = subeventsParentId === parentActivityId;
    const isLoadError = failedParentId === parentActivityId;
    const shouldShowSkeleton =
        isLoading || !activityCategory || !isCurrentParentLoaded;
    const isEndOfFeed =
        !isNextPageLoading &&
        !hasMoreSubevents &&
        subevents.length > 0;
    const onLoadMore = useCallback(() => {
        return fetchMoreActivitySubevents()
            .then(() => {
                setIsNextPageError(false);
            })
            .catch((error: unknown) => {
                setIsNextPageError(true);
                return Promise.reject(error);
            });
    }, [fetchMoreActivitySubevents]);
    const sentinelRef = useInfiniteScroll({
        hasMore: hasMoreSubevents && !isNextPageError,
        isLoading: isNextPageLoading,
        onLoadMore,
    });

    useEffect(() => {
        if (
            !parentActivityId ||
            !activityCategory ||
            isCurrentParentLoaded ||
            isLoadError
        ) {
            return;
        }

        void fetchSetActivitySubevents({
            parentActivityId,
            category: activityCategory,
        }).catch(() => {
            setFailedParentId(parentActivityId);
        });
    }, [
        parentActivityId,
        activityCategory,
        isCurrentParentLoaded,
        isLoadError,
        fetchSetActivitySubevents,
    ]);

    const onRetry = () => {
        if (!parentActivityId || !activityCategory) {
            return;
        }

        setFailedParentId(null);
        void fetchSetActivitySubevents({
            parentActivityId,
            category: activityCategory,
        }).catch(() => {
            setFailedParentId(parentActivityId);
        });
    };

    const onRetryNextPage = () => {
        void onLoadMore().catch(() => undefined);
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
