import { useEffect } from 'react';
import { LucideChevronsDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Spinner, Text } from '@radix-ui/themes';
import { useIntersectionObserver } from '@uidotdev/usehooks';

import { useActivityStore } from 'store/activityStore';
import { selectActivityLoading, selectActivityNextPageLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import ActivityHeader, { ActivityHeaderContext } from './ActivityHeader';
import { EventRenderer } from './components';

interface Props {
    context?: ActivityHeaderContext;
}

const Activity = ({ context = 'dashboard' }: Props) => {
    const { t } = useTranslation('activity');
    const { items, hasMore, fetchMoreActivity: fetchAppendActivity } = useActivityStore();
    const isLoading = useLoadingStore(selectActivityLoading);
    const isNextPageLoading = useLoadingStore(selectActivityNextPageLoading);

    const shouldShowHeader = context !== 'group';
    const isFullContext = context === 'full';
    const isEndOfFeed = !isNextPageLoading && !hasMore && items.length > 0;

    const [sentinelRef, sentinelEntry] = useIntersectionObserver({ threshold: 0 });

    useEffect(() => {
        if (!isFullContext) {
            return;
        }

        if (sentinelEntry?.isIntersecting && hasMore && !isNextPageLoading) {
            fetchAppendActivity();
        }
    }, [
        isFullContext,
        sentinelEntry?.isIntersecting,
        hasMore,
        isNextPageLoading,
        fetchAppendActivity,
    ]);

    return (
        <>
            {shouldShowHeader ? <ActivityHeader isLoading={isLoading} context={context} /> : null}

            {!isLoading && items.length === 0 ? (
                <Card size="2">
                    <Flex direction="column" gap="1">
                        <Text size="4" weight="medium" as="p">
                            {t('emptyTitle')}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('emptyDescription')}
                        </Text>
                    </Flex>
                </Card>
            ) : (
                <Flex direction="column" gap="3">
                    {items.map(event => (
                        <EventRenderer key={event.id} event={event} />
                    ))}

                    {isFullContext && (
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
                    )}
                </Flex>
            )}
        </>
    );
};

export default Activity;
