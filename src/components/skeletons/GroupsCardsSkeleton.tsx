import { LucideEye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const GroupsCardsSkeleton = () => {
    const { t: tDashboard } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');

    return (
        <Flex direction="column" gap="4">
            <Flex gap="2" wrap="wrap">
                <Skeleton>
                    <Button>{tDashboard('groups.filterAll')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>{tDashboard('summary.owedToYou')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>{tDashboard('summary.youOwe')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>
                        <LucideEye size={14} />
                        {tDashboard('groups.filterSettled')}
                    </Button>
                </Skeleton>
            </Flex>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <Card key={index} size="1">
                    <Flex gap="3" align="center">
                        <Skeleton>
                            <Avatar size="5" fallback="•" />
                        </Skeleton>

                        <Flex direction="column">
                            <Text size="4" weight="bold" as="span">
                                <Skeleton>
                                    {tSkeletons('groupsCards.groupName')}
                                </Skeleton>
                            </Text>

                            <Text size="2" color="grass" weight="medium" as="span">
                                <Skeleton>
                                    {tSkeletons('groupsCards.groupBalance')}
                                </Skeleton>
                            </Text>

                            <Text size="1" color="gray">
                                <Skeleton>{tSkeletons('groupsCards.members')}</Skeleton>
                            </Text>
                        </Flex>
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
};
