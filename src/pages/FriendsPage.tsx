import { useEffect } from 'react';
import { LucideUserPlus, LucideUsers } from 'lucide-react';

import { Avatar, Box, Button, Card, Container, Flex, Heading, Text } from '@radix-ui/themes';

import { useUsersStore } from 'store/usersStore';

import MobileNavBar from 'components/Navs/MobileNavBar';

const FriendsPage = () => {
    const { friends, fetchSetFriends } = useUsersStore();

    useEffect(() => {
        fetchSetFriends();
    }, [fetchSetFriends]);

    // const isLoadingFriends = useLoadingStore(state => state.users.friends);

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Flex direction="column" gap="4">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="4">
                        <Avatar size="5" color="cyan" fallback={<LucideUsers size={32} />} />
                        <Box>
                            <Heading size="6">Friends</Heading>
                            <Text size="2" color="gray">
                                Example layout for friends list
                            </Text>
                        </Box>
                    </Flex>
                    <Button variant="soft">
                        <LucideUserPlus size={16} />
                        Add friend
                    </Button>
                </Flex>

                <Card>
                    <Flex align="center" gap="2" mb="3">
                        <LucideUsers size={18} />
                        <Text weight="medium">Your connections</Text>
                    </Flex>

                    <Flex direction="column" gap="3">
                        {friends.map(({ id, picture, displayName }) => (
                            <Flex key={id} justify="between" align="center">
                                <Flex align="center" gap="3">
                                    <Avatar
                                        src={picture || ''}
                                        fallback={displayName.charAt(0)}
                                        size="2"
                                        radius="full"
                                    />
                                    <Box>
                                        <Text as="p" weight="medium">
                                            {displayName}
                                        </Text>
                                        <Text as="p" size="2">
                                            owed you $35.00
                                        </Text>
                                    </Box>
                                </Flex>
                            </Flex>
                        ))}
                    </Flex>
                </Card>
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
