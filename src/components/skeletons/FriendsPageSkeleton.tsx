import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const SKELETON_COUNT = 3;
const SKELETON_CURRENCY = 'USD';
const SKELETON_TOTAL = '+9999';
const SKELETON_NAME = 'Display Name John';
const SKELETON_AMOUNT = '+999 USD';

export const FriendsPageSkeleton = () => {
    return (
        <>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <Card key={i}>
                    <Flex justify="between" align="center" mb="3">
                        <Skeleton>
                            <Text size="3" weight="bold">
                                {SKELETON_CURRENCY}
                            </Text>
                        </Skeleton>
                        <Skeleton>
                            <Text size="3">{SKELETON_TOTAL}</Text>
                        </Skeleton>
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
                                    <Skeleton>
                                        <Text size={{ initial: '2', sm: '3' }}>
                                            {SKELETON_NAME}
                                        </Text>
                                    </Skeleton>
                                </Flex>
                                <Skeleton>
                                    <Text size="2">{SKELETON_AMOUNT}</Text>
                                </Skeleton>
                            </Flex>
                        ))}
                    </Flex>
                </Card>
            ))}
        </>
    );
};
