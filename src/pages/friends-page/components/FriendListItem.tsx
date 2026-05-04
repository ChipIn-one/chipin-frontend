import { Avatar, Flex, Skeleton, Text } from '@radix-ui/themes';

interface Props {
    picture: string | null;
    displayName: string;
    isLoading: boolean;
}

const FriendListItem = ({ picture, displayName, isLoading }: Props) => {
    return (
        <Flex justify="between" align="center">
            <Flex align="center" gap="3">
                <Skeleton loading={isLoading}>
                    <Avatar
                        src={picture || ''}
                        fallback={displayName.charAt(0)}
                        size="2"
                        radius="full"
                    />
                </Skeleton>
                <Flex direction="column" gap="1">
                    <Skeleton loading={isLoading}>
                        <Text as="span" weight="medium">
                            {displayName}
                        </Text>
                    </Skeleton>
                    <Skeleton loading={isLoading}>
                        <Text as="span" size="2">
                            owed you $35.00
                        </Text>
                    </Skeleton>
                </Flex>
            </Flex>
        </Flex>
    );
};

export default FriendListItem;
