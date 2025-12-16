import { useEffect } from 'react';
import { LucideUsers } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, Box, Button, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupStore } from 'store/groupStore';

import { Amount } from 'basics/numbers';
import BottomNavMobile from 'components/BottomNavMobile';
import Breadcrumbs from 'components/Breadcrumbs';
import UsersRow from 'components/UsersRow';

const MOCK_EXPENSES = [
    {
        id: '1',
        description: 'Lunch at Italian Restaurant',
        amount: 45.67,
        date: '2023-10-01',
        paidBy: 'Alice',
        involved: ['Alice', 'Bob', 'Charlie'],
    },
    {
        id: '2',
        description: 'Grocery Shopping',
        amount: 78.9,
        date: '2023-10-03',
        paidBy: 'Bob',
        involved: ['Alice', 'Bob'],
    },
    {
        id: '3',
        description: 'Movie Night',
        amount: 30.0,
        date: '2023-10-05',
        paidBy: 'Charlie',
        involved: ['Alice', 'Charlie'],
    },
];

const BalancesPage = () => {
    const { selectedGroup, setSelectedGroup, groups, fetchSetUserGroups } = useGroupStore();

    useEffect(() => {
        fetchSetUserGroups();
    }, [fetchSetUserGroups]);

    console.log(selectedGroup);
    return (
        <Box py="4">
            <Container size="4">
                <Breadcrumbs />
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
                            <Flex gap="2" m="4">
                                <LucideUsers /> <Text weight="medium">Your groups</Text>
                            </Flex>

                            <Flex gap="4" direction="column">
                                {groups.map(group => (
                                    <Card size="2" key={group.id} asChild>
                                        <button onClick={() => setSelectedGroup(group)}>
                                            <Flex gap="4" align="center" mb="2">
                                                <Avatar
                                                    size="4"
                                                    src={group.groupImg}
                                                    alt={group.name}
                                                    fallback={group.emoji || <LucideUsers />}
                                                />
                                                <Flex direction="column" gap="1" width="100%">
                                                    <Flex justify="between">
                                                        <Text size="4" weight="bold" as="p">
                                                            {group.name}
                                                        </Text>
                                                        <UsersRow members={group.members} max={2} />
                                                    </Flex>
                                                    <Text size="3" color="gray" as="p">
                                                        {group.members.length} members
                                                    </Text>

                                                    <Text size="2" color="grass" as="p">
                                                        You are owed{' '}
                                                        <Amount value={15} customPrefix="$" /> in
                                                        this group
                                                    </Text>
                                                </Flex>
                                            </Flex>
                                        </button>
                                    </Card>
                                ))}
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
                                    <Flex direction="column">
                                        <Text size="4" weight="medium" as="p" mb="2">
                                            Group expenses
                                        </Text>
                                        <Text size="2" as="p">
                                            {selectedGroup?.name}
                                        </Text>
                                    </Flex>
                                    <Link to={`${ROUTES.GROUP}/${selectedGroup.id}`}>
                                        <Button variant="ghost" size="2" mt="3">
                                            View all expenses
                                        </Button>
                                    </Link>
                                </Flex>
                            )}
                        </Box>
                        {MOCK_EXPENSES.map(expense => (
                            <Card key={expense.id} asChild size="1">
                                <button>
                                    <Flex justify="between" align="center" width="100%">
                                        <Box>
                                            <Text size="4" weight="medium" as="p">
                                                {expense.description}
                                            </Text>
                                            <Text size="2" color="gray" as="p">
                                                Paid by {expense.paidBy} on {expense.date}
                                            </Text>
                                        </Box>
                                        <Text size="4" weight="bold" as="p">
                                            <Amount value={expense.amount} customPrefix="$" />
                                        </Text>
                                    </Flex>
                                </button>
                            </Card>
                        ))}
                    </Box>
                </Grid>

                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default BalancesPage;
