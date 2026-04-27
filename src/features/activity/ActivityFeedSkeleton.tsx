import { Avatar, Box, Card, Flex, Skeleton } from '@radix-ui/themes';

const ExpenseEventSkeleton = () => (
    <Card size="1" mb="2">
        <Flex justify="between" align="center" gap="3">
            <Flex gap="4" align="center">
                <Skeleton>
                    <Avatar size="3" variant="soft" fallback="" />
                </Skeleton>
                <Flex direction="column" gap="1">
                    <Skeleton>
                        <Box width="140px" height="var(--space-4)" />
                    </Skeleton>
                    <Skeleton>
                        <Box width="200px" height="var(--space-3)" />
                    </Skeleton>
                </Flex>
            </Flex>
            <Flex direction="column" align="end" gap="1">
                <Skeleton>
                    <Box width="64px" height="var(--space-4)" />
                </Skeleton>
                <Skeleton>
                    <Box width="80px" height="var(--space-3)" />
                </Skeleton>
                <Skeleton>
                    <Box width="52px" height="var(--space-3)" />
                </Skeleton>
            </Flex>
        </Flex>
    </Card>
);

const MemberJoinEventSkeleton = () => (
    <Card size="1" mb="2">
        <Flex justify="between" align="center" gap="3">
            <Flex gap="4" align="center">
                <Skeleton>
                    <Avatar size="3" variant="soft" fallback="" />
                </Skeleton>
                <Flex gap="2" align="center">
                    <Skeleton>
                        <Avatar size="1" fallback="" />
                    </Skeleton>
                    <Skeleton>
                        <Box width="192px" height="var(--space-4)" />
                    </Skeleton>
                </Flex>
            </Flex>
            <Skeleton>
                <Box width="52px" height="var(--space-3)" />
            </Skeleton>
        </Flex>
    </Card>
);

const EXPENSE_COUNT = 10;
const SKELETON_ORDER = [0, 1, 2, 3, 6, 4, 5, 7, 8, 9] as const;
const MEMBER_JOIN_INDICES = new Set([2, 5, 8]);

interface Props {
    isExpensesOnly?: boolean;
}

const ActivityFeedSkeleton = ({ isExpensesOnly = false }: Props) => (
    <Flex direction="column" gap="2">
        {isExpensesOnly
            ? Array.from({ length: EXPENSE_COUNT }, (_, index) => (
                  <ExpenseEventSkeleton key={index} />
              ))
            : SKELETON_ORDER.map(index =>
                  MEMBER_JOIN_INDICES.has(index) ? (
                      <MemberJoinEventSkeleton key={index} />
                  ) : (
                      <ExpenseEventSkeleton key={index} />
                  ),
              )}
    </Flex>
);

export default ActivityFeedSkeleton;
