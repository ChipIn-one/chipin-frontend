import { LucideUsers } from 'lucide-react';

import { Box, Card, Container, Flex, Grid, Skeleton, Text } from '@radix-ui/themes';

import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';
import ActivityTemplate from 'components/ActivityTemplate';
import AddExpenseButton from 'components/AddExpenseButton';
import { GroupsCard } from 'components/GroupCard';
import MobileNavBar from 'components/Navs/MobileNavBar';

const DashboardPage = () => {
    const { isLoadingDashboard } = useDashboardStore();
    const { groups,  } = useGroupsStore();

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
                        <Card size="4">
                            <Flex direction="column" gap="3">
                                <Skeleton loading={isLoadingDashboard} width="140px">
                                    <Text size="4" weight="medium" as="p">
                                        Total balance
                                    </Text>
                                </Skeleton>
                                <Skeleton loading={isLoadingDashboard} width="100px">
                                    <Text size="6" color="grass" weight="bold">
                                        <Amount value={145.67} customPrefix="$" />
                                    </Text>
                                </Skeleton>
                                <Skeleton loading={isLoadingDashboard}>
                                    <Text size="4" color="gray">
                                        You are owed $37 across all groups
                                    </Text>
                                </Skeleton>
                            </Flex>
                        </Card>

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
