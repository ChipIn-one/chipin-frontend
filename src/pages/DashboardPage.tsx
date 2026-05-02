import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Container, Flex, Grid } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';
import { selectDashboardFetched, selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { NoGroupsEmptyState } from 'basics/empty-states';
import DashBoardSummary from 'components/DashboardSummary';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { CreateUpdateGroupModal } from 'components/modals';
import MobileNavBar from 'components/nav-bars/MobileNavBar';
import { ActivityFeedSkeleton } from 'features/activity';

const DashboardPage = () => {
    const { t } = useTranslation('dashboard');
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);

    const { groups } = useGroupsStore();
    const hasGroups = groups.length > 0;

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <Grid columns="3" gap="6">
                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 1',
                    }}
                >
                    <DashBoardSummary isLoading={isDashboardLoading} />

                    <Box>
                        <GroupsSectionHeader
                            mt="4"
                            mb="4"
                            label={t('groups.title')}
                            isLoading={isDashboardLoading}
                        />

                        <Flex gap="4" direction="column">
                            {!isDashboardFetched || hasGroups ? (
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
                    </Box>
                </Box>

                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 2',
                    }}
                >
                    <ActivityFeedSkeleton isExpensesOnly />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default DashboardPage;
