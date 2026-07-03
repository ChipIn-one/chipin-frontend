import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const ActivityEventSkeletonIcon = () => (
    <Skeleton>
        <Avatar size="3" variant="soft" fallback="" />
    </Skeleton>
);

export const ActivityExpenseEventSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <ActivityEventSkeletonIcon />
                    <Flex direction="column" gap="1">
                        <Text size="3" weight="medium">
                            <Skeleton>{t('activityFeed.expenseTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton>{t('activityFeed.expenseDescription')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Flex direction="column" align="end" gap="1">
                    <Text size="3" weight="bold">
                        <Skeleton>{t('activityFeed.expenseAmount')}</Skeleton>
                    </Text>
                    <Text size="2">
                        <Skeleton>{t('activityFeed.owedStatus')}</Skeleton>
                    </Text>
                    <Text size="1">
                        <Skeleton>{t('activityFeed.relativeTime')}</Skeleton>
                    </Text>
                </Flex>
            </Flex>
        </Card>
    );
};

export const ActivitySettlementEventSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <ActivityEventSkeletonIcon />
                    <Flex direction="column" gap="1">
                        <Text size="3" weight="medium">
                            <Skeleton>{t('activityFeed.expenseAmount')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton>{t('activityFeed.settlementDescription')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Text size="1">
                    <Skeleton>{t('activityFeed.relativeTime')}</Skeleton>
                </Text>
            </Flex>
        </Card>
    );
};
