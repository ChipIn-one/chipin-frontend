import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const GroupsCardsSkeleton = () => (
    <Flex direction="column" gap="4">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Card key={index} size="1">
                <Flex gap="3" align="center">
                    <Skeleton>
                        <Avatar size="5" fallback="•" />
                    </Skeleton>

                    <Flex direction="column">
                        <Text size="4" weight="bold" as="p">
                            <Skeleton>Group name</Skeleton>
                        </Text>

                        <Text size="2" color="grass" weight="medium" as="p">
                            <Skeleton>You are owed $15.00</Skeleton>
                        </Text>

                        <Text size="1" color="gray" as="p">
                            <Skeleton>3 members</Skeleton>
                        </Text>
                    </Flex>
                </Flex>
            </Card>
        ))}
    </Flex>
);
