import { LucideUserPlus, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Button, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

import { useFriendInvite } from 'hooks/pwaHooks';
import { useUsersStore } from 'store/users-store';

interface Props {
    isLoading: boolean;
}

const FriendsPageHeader = ({ isLoading }: Props) => {
    const { t } = useTranslation(['friends', 'common']);
    const user = useUsersStore(state => state.user);
    const {
        isNativeShareSupported,
        onShare,
        onCopyLink,
    } = useFriendInvite(user?.inviteToken ?? '');
    const shareContent = {
        title: t('friends:invite.shareTitle'),
        text: t('friends:invite.shareText'),
    };

    const onAddFriend = (): Promise<void> => {
        if (isNativeShareSupported) {
            return onShare(shareContent);
        }

        return onCopyLink();
    };

    return (
        <Flex
            justify="between"
            align={{ initial: 'center', sm: 'stretch' }}
            direction={{ initial: 'row', sm: 'column' }}
            gap={{ sm: '3' }}
        >
            <Flex align="center" gap={{ initial: '3', sm: '4' }}>
                <Skeleton loading={isLoading}>
                    <Avatar
                        size={{ initial: '4', sm: '5' }}
                        color="cyan"
                        fallback={<LucideUsers size={32} />}
                    />
                </Skeleton>
                <Box>
                    <Heading size={{ initial: '5', sm: '6' }}>
                        <Skeleton loading={isLoading}>{t('friends:title')}</Skeleton>
                    </Heading>
                    <Text size="2" color="gray">
                        <Skeleton loading={isLoading}>
                            {t('friends:yourConnections')}
                        </Skeleton>
                    </Text>
                </Box>
            </Flex>
            <Button
                variant="soft"
                loading={isLoading}
                disabled={!user?.inviteToken}
                onClick={onAddFriend}
            >
                <LucideUserPlus size={16} />
                <Box display={{ initial: 'none', sm: 'inline' }}>
                    <Text as="span">{t('common:buttons.addFriend')}</Text>
                </Box>
            </Button>
        </Flex>
    );
};

export default FriendsPageHeader;
