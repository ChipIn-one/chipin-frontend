import { LucideArrowRight, LucideBanana, LucideChartBar } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, Box, Button, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';
import { formatRelativeTime } from 'helpers/time';

import { Amount } from 'basics/numbers';

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
        // 13 days ago
        date: now - 13 * DAY,
        paidBy: 'Alice',
        involved: ['Alice', 'Bob'],
    },
];

interface Props {
    isLoading?: boolean;
}

const ActivityTemplate = ({ isLoading = false }: Props) => {
    return (
        <>
            <Box mb="6">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="4">
                        <Skeleton loading={isLoading}>
                            <Avatar size="5" color="cyan" fallback={<LucideChartBar size={32} />} />
                        </Skeleton>
                        <Flex direction="column">
                            <Skeleton loading={isLoading}>
                                <Text size="4" weight="medium" as="p" mb="2">
                                    Your last activity
                                </Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" as="p">
                                    From your groups and friends
                                </Text>
                            </Skeleton>
                        </Flex>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <Link to={ROUTES.ACTIVITY}>
                            <Button variant="ghost" size="4">
                                View all activities
                                <LucideArrowRight />
                            </Button>
                        </Link>
                    </Skeleton>
                </Flex>
            </Box>

            {MOCK_EXPENSES.map(expense => (
                <Card key={expense.id} asChild size="2" mb="4">
                    <button style={{ width: '100%' }}>
                        <Flex justify="between" align="center">
                            <Flex gap="4" align="center">
                                <Skeleton loading={isLoading}>
                                    <Avatar size="3" color="cyan" fallback={<LucideBanana />} />
                                </Skeleton>
                                <Box>
                                    <Flex direction="column" gap="1">
                                        <Skeleton loading={isLoading}>
                                            <Text size="4" weight="medium" as="p">
                                                {expense.description}
                                            </Text>
                                        </Skeleton>
                                        <Skeleton loading={isLoading}>
                                            <Text size="2" color="gray" as="p">
                                                Paid by {expense.paidBy}. You owed something
                                            </Text>
                                        </Skeleton>
                                    </Flex>
                                </Box>
                            </Flex>
                            <Flex direction="column" align="end" gap="1">
                                <Skeleton loading={isLoading}>
                                    <Text size="4" weight="bold" as="p">
                                        <Amount value={expense.amount} customPrefix="$" />
                                    </Text>
                                </Skeleton>
                                <Skeleton loading={isLoading}>
                                    <Text size="2" color="gray" as="p">
                                        {formatRelativeTime(expense.date)}
                                    </Text>
                                </Skeleton>
                            </Flex>
                        </Flex>
                    </button>
                </Card>
            ))}
        </>
    );
};

export default ActivityTemplate;
