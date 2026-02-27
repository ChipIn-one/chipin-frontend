import { LucideUsers } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Box, Card, Container, Flex, Grid, Skeleton, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';
import ActivityTemplate from 'components/ActivityTemplate';
import AddExpenseButton from 'components/AddExpenseButton';
import GroupAvatar from 'components/GroupAvatar';
import MobileNavBar from 'components/Navs/MobileNavBar';
import UsersRow from 'components/UsersRow';

const DashboardPage = () => {
    const { isLoadingDashboard } = useDashboardStore();
    const { groups, setSelectedGroup } = useGroupsStore();

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
                                {groups.map(group => {
                                    return (
                                        <Card variant={'classic'} key={group.id} asChild>
                                            <Link
                                                to={`${ROUTES.GROUP}/${group.id}`}
                                                onClick={() => setSelectedGroup(group)}
                                            >
                                                <Flex gap="4" align="center" mb="2">
                                                    <GroupAvatar group={group} />

                                                    <Flex direction="column" gap="1" width="100%">
                                                        <Text size="5" weight="bold" as="p">
                                                            {group.name}
                                                        </Text>

                                                        <UsersRow members={group.members} />

                                                        <Text size="2" color="grass" as="p">
                                                            You are owed{' '}
                                                            <Amount value={15} customPrefix="$" />{' '}
                                                            in this group
                                                        </Text>
                                                    </Flex>
                                                </Flex>
                                            </Link>
                                        </Card>
                                    );
                                })}
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
