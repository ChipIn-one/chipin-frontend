import { LucideChevronsDown, LucideListTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Container, Flex, Spinner, Text } from '@radix-ui/themes';

import { EmptyState } from 'basics/empty-states';
import { MobileNavBar } from 'components/nav-bars';
import { ActivityChildrenEventsSkeleton, ActivityChildrenPageSkeleton } from 'components/skeletons';
import { ActivityChildrenHeader, ActivityEventsList } from 'features/activity/components';

import { useActivityChildrenPageData } from './internal';

const ActivityChildrenPage = () => {
    const { t } = useTranslation('activity');
    const {
        parentEvent,
        childItems,
        shouldShowSkeleton,
        isNextPageLoading,
        isDeletingEntry,
        canDeleteEntry,
        isEndOfFeed,
        sentinelRef,
        onDeleteEntry,
    } = useActivityChildrenPageData();

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivityChildrenHeader
                parentEvent={parentEvent}
                isDeleting={isDeletingEntry}
                canDelete={canDeleteEntry}
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

            <MobileNavBar />
        </Container>
    );
};

export default ActivityChildrenPage;
