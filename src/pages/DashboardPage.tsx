import { LucideUsers } from 'lucide-react';

import { Box, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';

import ActivityTemplate from 'components/ActivityTemplate';
import AddExpenseButton from 'components/AddExpenseButton';
import DashBoardSummary from 'components/DashboardSummary';
import { GroupsCard } from 'components/GroupsCard';
import MobileNavBar from 'components/Navs/MobileNavBar';

const DashboardPage = () => {
    const { isLoadingDashboard } = useDashboardStore();
    const { groups } = useGroupsStore();

    return (
        <>
            <Container size="4">
                <Grid columns="3" gap="6">
                    <Box
                        gridColumn={{
                            initial: 'span 3',
                            sm: 'span 1',
                        }}
                        mb="6"
                    >
                        <DashBoardSummary isLoading={isLoadingDashboard} />

                        <Box>
                            <Flex gap="2" mb="6" mt="6">
                                <Flex justify="between" width="100%" pl="2" pr="2">
                                    <Flex align="center" gap="2">
                                        <LucideUsers /> <Text weight="medium">Your groups</Text>
                                    </Flex>
                                    <Flex>Filter?</Flex>
                                </Flex>
                            </Flex>

                            <Flex gap="5" direction="column">
                                <GroupsCard groups={groups} />
                            </Flex>
                        </Box>
                    </Box>

                    <Box
                        gridColumn={{
                            initial: 'span 3',
                            sm: 'span 2',
                        }}
                    >
                        <ActivityTemplate isLoading={isLoadingDashboard} />
                    </Box>
                </Grid>

                <MobileNavBar />
                <AddExpenseButton />
            </Container>
        </>
    );
};

export default DashboardPage;
