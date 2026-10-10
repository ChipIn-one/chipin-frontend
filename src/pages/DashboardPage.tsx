import { useCallback } from 'react';
import {
    LucideChevronsDown,
    LucidePlus,
    LucideRefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Container, Flex, Spinner, Text } from '@radix-ui/themes';

import { useInfiniteScroll } from 'hooks/useInfiniteScroll';

import { EmptyState, NoGroupsEmptyState } from 'basics/empty-states';
import { DashboardOnboarding } from 'components/dashboard-onboarding';
import {
    DashboardHeader as DashboardGreeting,
    DashboardSummary as DashBoardSummary,
} from 'components/dashboard-summary';
import GroupsCards from 'components/GroupsCards';
import { InternalPageColumnsFromSm } from 'components/internal-page-layout';
import { CreateUpdateGroupModal } from 'components/modals/create-update-group-modal';
import { ActivityFeedSkeleton } from 'components/skeletons';
import { ActivityEventsList } from 'features/activity';

import { useConnect } from './internal/dashboard-page';

const DashboardPage = () => {
    const { t } = useTranslation(['dashboard', 'activity']);
    const {
        activityEvents,
        fetchMoreDashboardActivity,
        groups,
        dashboardView,
        hasGroups,
        hasGroupExpenseHistory,
        hasMoreActivity,
        isDashboardFetched,
        isDashboardLoading,
        isEndOfFeed,
        isGroupListFetched,
        isNextPageError,
        isNextPageLoading,
        onRetryLoad,
    } = useConnect();

    const onLoadMore = useCallback(() => {
        return fetchMoreDashboardActivity();
    }, [fetchMoreDashboardActivity]);

    const sentinelRef = useInfiniteScroll({
        hasMore: hasMoreActivity && !isNextPageError,
        isLoading: isNextPageLoading,
        onLoadMore,
    });

    const onRetryNextPage = () => {
        onLoadMore();
    };

    const sidePanel = dashboardView === 'error' ? null : (
        <Flex direction="column" gap="4">
            <Box display={{ initial: 'block', lg: 'none' }}>
                <DashboardGreeting />
            </Box>

            <DashBoardSummary
                isLoading={isDashboardLoading}
                hasGroups={hasGroupExpenseHistory}
            />

            <Flex gap="4" direction="column">
                {!isDashboardFetched ||
                !isGroupListFetched ||
                hasGroups ? (
                    <GroupsCards
                        groups={groups}
                        label={t('groups.title')}
                    />
                ) : (
                    <NoGroupsEmptyState
                        action={
                            dashboardView !== 'dashboard' ? undefined : (
                                <CreateUpdateGroupModal type="create">
                                    <Button
                                        size="2"
                                        variant="soft"
                                        width="100%"
                                    >
                                        <LucidePlus size={14} />
                                        {t(
                                            'common:buttons.createGroup',
                                        )}
                                    </Button>
                                </CreateUpdateGroupModal>
                            )
                        }
                    />
                )}
            </Flex>
        </Flex>
    );

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm sidePanel={sidePanel}>
                {dashboardView === 'welcome' ? (
                    <DashboardOnboarding />
                ) : dashboardView === 'loading' ? (
                    <ActivityFeedSkeleton isShowSummary />
                ) : dashboardView === 'error' ? (
                    <EmptyState
                        icon={<LucideRefreshCw size={20} />}
                        title={t('errors.loadTitle')}
                        description={t('errors.loadDescription')}
                        action={
                            <Button type="button" variant="soft" onClick={onRetryLoad}>
                                <LucideRefreshCw size={14} />
                                {t('activity:retryAction')}
                            </Button>
                        }
                    />
                ) : (
                    <ActivityEventsList
                        events={activityEvents}
                        isShowSummary
                        isNavigable
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
                                        {t('activity:retryAction')}
                                    </Button>
                                </Flex>
                            )}

                            {isEndOfFeed && (
                                <Flex
                                    justify="center"
                                    align="center"
                                    gap="2"
                                    py="4"
                                >
                                    <Text as="span" color="gray">
                                        <LucideChevronsDown
                                            size={14}
                                        />
                                    </Text>
                                    <Text size="1" color="gray">
                                        {t('activity:endOfFeed')}
                                    </Text>
                                </Flex>
                            )}

                            <div ref={sentinelRef} />
                        </>
                    </ActivityEventsList>
                )}
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default DashboardPage;
