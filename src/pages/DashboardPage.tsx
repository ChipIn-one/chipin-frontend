import { useCallback, useState } from 'react';
import { LucideChevronsDown, LucidePlus, LucideRefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Container, Flex, Spinner, Text } from '@radix-ui/themes';

import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectDashboardFetched,
    selectDashboardLoading,
    selectDashboardNextPageLoading,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { NoGroupsEmptyState } from 'basics/empty-states';
import {
    DashboardHeader as DashboardGreeting,
    DashboardSummary as DashBoardSummary,
} from 'components/dashboard-summary';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { InternalPageColumnsFromSm } from 'components/internal-page-layout';
import { CreateUpdateGroupModal } from 'components/modals';
import { ActivityFeedSkeleton } from 'components/skeletons';
import { ActivityEventsList } from 'features/activity';

const DashboardPage = () => {
    const { t } = useTranslation(['dashboard', 'activity']);
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const isNextPageLoading = useLoadingStore(selectDashboardNextPageLoading);
    const isGroupListFetched = useLoadingStore(selectGroupListFetched);

    const { activityItems, activityNextCursor, fetchMoreDashboardActivity } = useDashboardStore(
        useShallow(state => ({
            activityItems: state.activityItems,
            activityNextCursor: state.activityNextCursor,
            fetchMoreDashboardActivity: state.fetchMoreDashboardActivity,
        })),
    );
    const groups = useGroupsStore(s => s.groups);
    const hasGroups = groups.length > 0;
    const [failedActivityCursor, setFailedActivityCursor] = useState<number | null>(null);
    const hasMoreActivity = activityNextCursor !== null;
    const isNextPageError =
        failedActivityCursor !== null && failedActivityCursor === activityNextCursor;
    const isEndOfFeed = !isNextPageLoading && !hasMoreActivity && activityItems.length > 0;

    const onLoadMore = useCallback(() => {
        return fetchMoreDashboardActivity()
            .then(() => {
                setFailedActivityCursor(null);
            })
            .catch((error: unknown) => {
                setFailedActivityCursor(activityNextCursor);
                return Promise.reject(error);
            });
    }, [activityNextCursor, fetchMoreDashboardActivity]);

    const sentinelRef = useInfiniteScroll({
        hasMore: hasMoreActivity && !isNextPageError,
        isLoading: isNextPageLoading,
        onLoadMore,
    });

    const onRetryNextPage = () => {
        void onLoadMore().catch(() => undefined);
    };

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm
                sidePanel={
                    <Flex direction="column" gap="4">
                        <Box display={{ initial: 'block', lg: 'none' }}>
                            <DashboardGreeting />
                        </Box>

                        <Box display={{ initial: 'block' }}>
                            <DashBoardSummary isLoading={isDashboardLoading} />
                        </Box>

                        <Flex direction="column" gap="4">
                            <GroupsSectionHeader
                                label={t('groups.title')}
                                isLoading={isDashboardLoading}
                            />

                            <Flex gap="4" direction="column">
                                {!isDashboardFetched || !isGroupListFetched || hasGroups ? (
                                    <GroupsCards groups={groups} />
                                ) : (
                                    <NoGroupsEmptyState
                                        action={
                                            <CreateUpdateGroupModal type="create">
                                                <Button size="2" variant="soft">
                                                    <LucidePlus size={14} />
                                                    {t('common:buttons.createGroup')}
                                                </Button>
                                            </CreateUpdateGroupModal>
                                        }
                                    />
                                )}
                            </Flex>
                        </Flex>
                    </Flex>
                }
            >
                {!isDashboardFetched || isDashboardLoading ? (
                    <ActivityFeedSkeleton isShowSummary />
                ) : (
                    <ActivityEventsList
                        events={activityItems.map(item => item.lastEvent)}
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
                                <Flex justify="center" align="center" gap="2" py="4">
                                    <Text as="span" color="gray">
                                        <LucideChevronsDown size={14} />
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
