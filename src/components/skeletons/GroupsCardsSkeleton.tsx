import { useTranslation } from 'react-i18next';

import { Avatar, Box, Button, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const GroupsCardsSkeleton = () => {
    const { t } = useTranslation('dashboard');

    return (
        <Flex direction="column" gap="4">
            <Flex gap="2">
                <Skeleton>
                    <Button>{t('groups.filterAll')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>{t('summary.owedToYou')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>{t('summary.youOwe')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button>{t('groups.filterSettled')}</Button>
                </Skeleton>
            </Flex>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <Card key={index} size="1">
                    <Flex gap="3" align="center">
                        <Skeleton>
                            <Avatar size="5" fallback="•" />
                        </Skeleton>

                        <Flex direction="column">
                            <Text size="4" weight="bold" as="p">
                                <Skeleton>
                                    <Box width="120px" height="var(--space-4)" />
                                </Skeleton>
                            </Text>

                            <Text size="2" color="grass" weight="medium" as="p">
                                <Skeleton>
                                    <Box width="140px" height="var(--space-3)" />
                                </Skeleton>
                            </Text>

                            <Text size="1" color="gray" as="p">
                                <Skeleton>{t('groupsCard.members', { count: 3 })}</Skeleton>
                            </Text>
                        </Flex>
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
};
