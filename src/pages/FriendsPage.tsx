import { useEffect } from 'react';
import { LucideUserPlus, LucideUsers } from 'lucide-react';

import {
    Avatar,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Heading,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import MobileNavBar from 'components/Navs/MobileNavBar';

const FRIENDS_SKELETON_ITEMS = Array.from({ length: 5 }, (_, index) => ({
    id: `friend-skeleton-${index}`,
    picture: '',
    displayName: 'Display Name John',
}));

const FriendsPage = () => {
    const { friends, fetchSetFriends } = useUsersStore();
    const isLoadingFriends = useLoadingStore(state => state.users.friends);

    useEffect(() => {
        if (!friends.length) {
            fetchSetFriends();
        }
    }, [friends, fetchSetFriends]);

    const isSkeletonShown = isLoadingFriends && !friends.length;
    const visibleFriends = isSkeletonShown ? FRIENDS_SKELETON_ITEMS : friends;

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Flex direction="column" gap="4">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="4">
                        <Avatar size="5" color="cyan" fallback={<LucideUsers size={32} />} />
                        <Box>
                            <Heading size="6">Friends</Heading>
                            <Text size="2" color="gray">
                                Your contacts and connections
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
                        <Skeleton loading={isSkeletonShown}>
                            <LucideUsers size={18} />
                            <Text weight="medium">Your connections</Text>
                        </Skeleton>
                    </Flex>

                    <Flex direction="column" gap="3">
                        {visibleFriends.map(({ id, picture, displayName }) => (
                            <Flex key={id} justify="between" align="center">
                                <Flex align="center" gap="3">
                                    <Skeleton loading={isSkeletonShown}>
                                        <Avatar
                                            src={picture || ''}
                                            fallback={displayName.charAt(0)}
                                            size="2"
                                            radius="full"
                                        />
                                    </Skeleton>
                                    <Flex direction="column" gap="1">
                                        <Skeleton loading={isSkeletonShown}>
                                            <Text as="span" weight="medium">
                                                {displayName}
                                            </Text>
                                        </Skeleton>
                                        <Skeleton loading={isSkeletonShown}>
                                            <Text as="span" size="2">
                                                owed you $35.00
                                            </Text>
                                        </Skeleton>
                                    </Flex>
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
