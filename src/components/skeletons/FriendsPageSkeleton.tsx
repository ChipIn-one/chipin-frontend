import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const FriendsPageSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <Card key={i}>
                    <Flex justify="between" align="center" mb="3">
                        <Text size="3" weight="bold">
                            <Skeleton>
                                {t('friendsPage.currency')}
                            </Skeleton>
                        </Text>
                        <Text size="3">
                            <Skeleton>{t('friendsPage.total')}</Skeleton>
                        </Text>
                    </Flex>
                    <Flex direction="column" gap="3">
                        {Array.from({ length: 2 }, (_, j) => (
                            <Flex key={j} justify="between" align="center">
                                <Flex align="center" gap="3">
                                    <Skeleton>
                                        <Avatar
                                            size={{ initial: '1', sm: '2' }}
                                            radius="full"
                                            fallback="A"
                                        />
                                    </Skeleton>
                                    <Text size={{ initial: '2', sm: '3' }}>
                                        <Skeleton>
                                            {t('friendsPage.name')}
                                        </Skeleton>
                                    </Text>
                                </Flex>
                                <Text size="2">
                                    <Skeleton>{t('friendsPage.amount')}</Skeleton>
                                </Text>
                            </Flex>
                        ))}
                    </Flex>
                </Card>
            ))}
        </>
    );
};
