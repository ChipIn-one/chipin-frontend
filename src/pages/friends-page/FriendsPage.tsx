import { LucideUserPlus, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Container, Flex, Skeleton, Text } from '@radix-ui/themes';

import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import { NoFriendsEmptyState } from 'basics/empty-states';
import MobileNavBar from 'components/nav-bars/MobileNavBar';

import FriendListItem from './components/FriendListItem';
import FriendsPageHeader from './components/FriendsPageHeader';

const FRIENDS_SKELETON_ITEMS = Array.from({ length: 5 }, (_, index) => ({
    id: `friend-skeleton-${index}`,
    picture: '',
    displayName: 'Display Name John',
}));

const FriendsPage = () => {
    const { t } = useTranslation(['common', 'friends']);
    const { friends } = useUsersStore();
    const isLoadingFriends = useLoadingStore(state => state.users.friends);

    const isSkeletonShown = isLoadingFriends && !friends.length;
    const isEmptyFriends = !isLoadingFriends && friends.length === 0;
    const visibleFriends = isSkeletonShown ? FRIENDS_SKELETON_ITEMS : friends;

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Flex direction="column" gap="4">
                <FriendsPageHeader isLoading={isSkeletonShown} />

                <Card>
                    <Flex align="center" gap="2" mb="3">
                        <Skeleton loading={isSkeletonShown}>
                            <LucideUsers size={18} />
                            <Text weight="medium">{t('friends:yourConnections')}</Text>
                        </Skeleton>
                    </Flex>

                    <Flex direction="column" gap="3">
                        {isEmptyFriends ? (
                            <NoFriendsEmptyState
                                action={
                                    <Button size="2" variant="soft">
                                        <LucideUserPlus size={14} />
                                        {t('buttons.addFriend')}
                                    </Button>
                                }
                            />
                        ) : (
                            visibleFriends.map(({ id, picture, displayName }) => (
                                <FriendListItem
                                    key={id}
                                    picture={picture}
                                    displayName={displayName}
                                    isLoading={isSkeletonShown}
                                />
                            ))
                        )}
                    </Flex>
                </Card>
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
