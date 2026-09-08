import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const ActivityEventSkeletonIcon = () => (
    <Skeleton>
        <Avatar size="4" variant="soft" fallback="" />
    </Skeleton>
);

const ActivityEventSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <Card size="1" mb="2" data-activity-event-skeleton>
            <Flex justify="between" align="center" gap="3">
                <Flex direction="column" gap="1" minWidth="0">
                    <Text size="3" weight="medium">
                        <Skeleton>{t('activityFeed.expenseTitle')}</Skeleton>
                    </Text>

                    <Flex gap="3" align="center" minWidth="0">
                        <ActivityEventSkeletonIcon />
                        <Flex direction="column" align="start" gap="1">
                            <Text size="3" color="gray" weight="medium">
                                <Skeleton>{t('activityFeed.expenseDescription')}</Skeleton>
                            </Text>
                            <Skeleton>
                                <Badge size="1" variant="soft" color="gray">
                                    {t('activityFeed.scope')}
                                </Badge>
                            </Skeleton>
                        </Flex>
                    </Flex>
                </Flex>

                <Flex direction="column" align="end" flexShrink="0">
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

export { ActivityEventSkeleton };
