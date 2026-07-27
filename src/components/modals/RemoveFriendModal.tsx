import { UserAvatar } from 'basics';
import { LucideHeartCrack } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import styled from 'styled-components';

import { Avatar, Button, Dialog, Flex, Text } from '@radix-ui/themes';

import type { FriendUser } from 'api/chipin.types';
import { themeColor } from 'helpers/colors';
import { selectFriendRemoving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import { BaseModal, MODAL_SIZES } from './base-modal';

const FriendPreview = styled(Flex)`
    padding: var(--space-4);
    border: 1px solid ${themeColor('grayA6')};
    border-radius: var(--radius-3);
    background: ${themeColor('grayA2')};
`;

interface Props {
    friend: FriendUser;
    isOpened: boolean;
    setIsOpened: (isOpen: boolean) => void;
}

const RemoveFriendModal = ({ friend, isOpened, setIsOpened }: Props) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const removeFriend = useUsersStore(state => state.removeFriend);
    const isRemovingFriend = useLoadingStore(selectFriendRemoving);

    const onRemoveFriend = () => {
        removeFriend({ userId: friend.id }).then(friendDisplayName => {
            setIsOpened(false);
            toast.success(t('toasts:friend.removed', { name: friendDisplayName }));
        });
    };

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            title={t('friends:removeModal.title')}
            maxWidth={MODAL_SIZES.default}
            content={
                <Flex direction="column" gap="4">
                    <FriendPreview align="center" justify="between" gap="4">
                        <Flex align="center" gap="3" minWidth="0">
                            <UserAvatar user={friend} size="4" />

                            <Flex direction="column" minWidth="0">
                                <Text size="1" color="gray">
                                    {t('friends:removeModal.friendLabel')}
                                </Text>
                                <Text size="4" weight="medium" truncate>
                                    {friend.displayName}
                                </Text>
                            </Flex>
                        </Flex>

                        <Avatar
                            size="4"
                            radius="medium"
                            variant="soft"
                            color="red"
                            fallback={<LucideHeartCrack size={20} />}
                        />
                    </FriendPreview>

                    <Flex gap="1" direction="column">
                        <Text size="3" weight="medium">
                            {t('friends:removeModal.confirm')}
                        </Text>

                        <Text size="2" color="gray">
                            {t('friends:removeModal.description')}
                        </Text>
                    </Flex>

                    <Flex justify="end" gap="4">
                        <Dialog.Close>
                            <Button size="3" variant="soft" color="gray">
                                {t('common:buttons.cancel')}
                            </Button>
                        </Dialog.Close>

                        <Button
                            size="3"
                            variant="solid"
                            color="red"
                            onClick={onRemoveFriend}
                            loading={isRemovingFriend}
                        >
                            {t('friends:actions.removeFriend')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default RemoveFriendModal;
