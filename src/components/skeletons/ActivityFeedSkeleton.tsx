import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

interface ActivityFeedSkeletonMessages {
    expenseTitle: string;
    expenseDescription: string;
    expenseAmount: string;
    owedStatus: string;
    relativeTime: string;
    memberJoined: string;
}

interface EventSkeletonProps {
    messages: ActivityFeedSkeletonMessages;
}

const ExpenseEventSkeleton = ({ messages }: EventSkeletonProps) => (
    <Card size="1" mb="2">
        <Flex justify="between" align="center" gap="3">
            <Flex gap="4" align="center">
                <Skeleton>
                    <Avatar size="3" variant="soft" fallback="" />
                </Skeleton>
                <Flex direction="column" gap="1">
                    <Text size="3" weight="medium">
                        <Skeleton>
                            {messages.expenseTitle}
                        </Skeleton>
                    </Text>
                    <Text size="2" color="gray">
                        <Skeleton>
                            {messages.expenseDescription}
                        </Skeleton>
                    </Text>
                </Flex>
            </Flex>
            <Flex direction="column" align="end" gap="1">
                <Text size="3" weight="bold">
                    <Skeleton>
                        {messages.expenseAmount}
                    </Skeleton>
                </Text>
                <Text size="2">
                    <Skeleton>
                        {messages.owedStatus}
                    </Skeleton>
                </Text>
                <Text size="1">
                    <Skeleton>
                        {messages.relativeTime}
                    </Skeleton>
                </Text>
            </Flex>
        </Flex>
    </Card>
);

const MemberJoinEventSkeleton = ({ messages }: EventSkeletonProps) => (
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
                    <Text size="3">
                        <Skeleton>
                            {messages.memberJoined}
                        </Skeleton>
                    </Text>
                </Flex>
            </Flex>
            <Text size="1">
                <Skeleton>
                    {messages.relativeTime}
                </Skeleton>
            </Text>
        </Flex>
    </Card>
);

const EXPENSE_COUNT = 10;
const SKELETON_ORDER = [0, 1, 2, 3, 6, 4, 5, 7, 8, 9] as const;
const MEMBER_JOIN_INDICES = new Set([2, 5, 8]);

interface Props {
    isExpensesOnly?: boolean;
}

export const ActivityFeedSkeleton = ({ isExpensesOnly = false }: Props) => {
    const { t } = useTranslation('skeletons');
    const messages: ActivityFeedSkeletonMessages = {
        expenseTitle: t('activityFeed.expenseTitle'),
        expenseDescription: t('activityFeed.expenseDescription'),
        expenseAmount: t('activityFeed.expenseAmount'),
        owedStatus: t('activityFeed.owedStatus'),
        relativeTime: t('activityFeed.relativeTime'),
        memberJoined: t('activityFeed.memberJoined'),
    };

    return (
        <Flex direction="column" gap="2">
            {isExpensesOnly
                ? Array.from({ length: EXPENSE_COUNT }, (_, index) => (
                      <ExpenseEventSkeleton key={index} messages={messages} />
                  ))
                : SKELETON_ORDER.map(index =>
                      MEMBER_JOIN_INDICES.has(index) ? (
                          <MemberJoinEventSkeleton key={index} messages={messages} />
                      ) : (
                          <ExpenseEventSkeleton key={index} messages={messages} />
                      ),
                  )}
        </Flex>
    );
};
