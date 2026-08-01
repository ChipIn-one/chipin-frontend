import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Container, Flex } from '@radix-ui/themes';

import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectDashboardFetched,
    selectDashboardLoading,
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
    const { t } = useTranslation('dashboard');
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const isGroupListFetched = useLoadingStore(selectGroupListFetched);

    const activityItems = useDashboardStore(s => s.activityItems);
    const groups = useGroupsStore(s => s.groups);
    const hasGroups = groups.length > 0;

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
                                {!isDashboardFetched ||
                                !isGroupListFetched ||
                                hasGroups ? (
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
                        events={activityItems}
                        isShowSummary
                        isNavigable
                    />
                )}
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default DashboardPage;
