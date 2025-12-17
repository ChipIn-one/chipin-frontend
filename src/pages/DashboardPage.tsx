import { useEffect } from 'react';
import { LucideArrowRight, LucideBanana, LucideUsers } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, Box, Button, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';
import { formatRelativeTime } from 'helpers/time';
import { useGroupStore } from 'store/groupStore';

import { Amount } from 'basics/numbers';
import GroupAvatar from 'components/GroupAvatar';
import UsersRow from 'components/UsersRow';
const now = Date.now();

const MOCK_EXPENSES = [
    {
        id: '1',
        description: 'Lunch at Italian Restaurant',
        amount: 45.67,
        // 30 seconds ago
        date: now - 30 * SECOND,
        paidBy: 'Alice',
        involved: ['Alice', 'Bob', 'Charlie'],
    },
    {
        id: '2',
        description: 'Morning Coffee',
        amount: 4.5,
        // 10 minutes ago
        date: now - 10 * MINUTE,
        paidBy: 'Bob',
        involved: ['Bob'],
    },
    {
        id: '3',
        description: 'Grocery Shopping',
        amount: 78.9,
        // 3 hours ago
        date: now - 3 * HOUR,
        paidBy: 'Bob',
        involved: ['Alice', 'Bob'],
    },
    {
        id: '4',
        description: 'Movie Night',
        amount: 30.0,
        // Yesterday
        date: now - 3 * DAY,
        paidBy: 'Charlie',
        involved: ['Alice', 'Charlie'],
    },
    {
        id: '5',
        description: 'Weekend Trip',
        amount: 210.0,
        // 3 days ago
        date: now - 13 * DAY,
        paidBy: 'Alice',
        involved: ['Alice', 'Bob'],
    },
];

const DashboardPage = () => {
    const { selectedGroup, setSelectedGroup, groups, fetchSetUserGroups } = useGroupStore();

    //TODO: Make only initial loading now on dashboard load
    useEffect(() => {
        fetchSetUserGroups();
    }, [fetchSetUserGroups]);

    console.log(selectedGroup);
    return (
        <Box py="6">
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
                                <Text size="4" weight="medium" as="p">
                                    Total balance
                                </Text>
                                <Text size="6" color="grass" weight="bold" as="p">
                                    <Amount value={145.67} customPrefix="$" />
                                </Text>
                                <Text size="2" color="gray" as="p">
                                    You are owed $37 across all groups
                                </Text>
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
                                    const isSelected = selectedGroup?.id === group.id;

                                    return (
                                        <Card
                                            m={isSelected ? '0' : '3'}
                                            variant={isSelected ? 'classic' : 'ghost'}
                                            key={group.id}
                                            asChild
                                        >
                                            <button onClick={() => setSelectedGroup(group)}>
                                                <Flex gap="4" align="center" mb="2">
                                                    <GroupAvatar group={group} />
                                                    <Flex direction="column" gap="1" width="100%">
                                                        <Flex justify="between">
                                                            <Text size="5" weight="bold" as="p">
                                                                {group.name}
                                                            </Text>
                                                            <UsersRow members={group.members} />
                                                        </Flex>
                                                        <Text size="3" color="gray" as="p">
                                                            {group.members.length} members
                                                        </Text>

                                                        <Text size="2" color="grass" as="p">
                                                            You are owed{' '}
                                                            <Amount value={15} customPrefix="$" />{' '}
                                                            in this group
                                                        </Text>
                                                    </Flex>
                                                </Flex>
                                            </button>
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
                        <Box mb="6">
                            {selectedGroup && (
                                <Flex justify="between" align="center">
                                    <Flex align="center" gap="4">
                                        <GroupAvatar group={selectedGroup} />
                                        <Flex direction="column">
                                            <Text size="4" weight="medium" as="p" mb="2">
                                                Group expenses
                                            </Text>
                                            <Text size="2" as="p">
                                                {selectedGroup?.name}
                                            </Text>
                                        </Flex>
                                    </Flex>

                                    <Link to={`${ROUTES.GROUP}/${selectedGroup.id}`}>
                                        <Button variant="ghost" size="3">
                                            View all expenses
                                            <LucideArrowRight />
                                        </Button>
                                    </Link>
                                </Flex>
                            )}
                        </Box>
                        {MOCK_EXPENSES.map(expense => (
                            <Card key={expense.id} asChild size="2" mb="4">
                                <button style={{ width: '100%' }}>
                                    <Flex justify="between" align="center">
                                        <Flex gap="4" align="center">
                                            <Avatar
                                                size="3"
                                                color="cyan"
                                                fallback={<LucideBanana />}
                                            />
                                            <Box>
                                                <Text size="4" weight="medium" as="p">
                                                    {expense.description}
                                                </Text>
                                                <Text size="2" color="gray" as="p">
                                                    Paid by {expense.paidBy}. You owed something
                                                </Text>
                                            </Box>
                                        </Flex>
                                        <Flex direction="column" align="end" gap="1">
                                            <Text size="4" weight="bold" as="p">
                                                <Amount value={expense.amount} customPrefix="$" />
                                            </Text>
                                            <Text size="2" color="gray" as="p">
                                                {formatRelativeTime(expense.date)}
                                            </Text>
                                        </Flex>
                                    </Flex>
                                </button>
                            </Card>
                        ))}
                    </Box>
                </Grid>
            </Container>
        </Box>
    );
};

export default DashboardPage;
