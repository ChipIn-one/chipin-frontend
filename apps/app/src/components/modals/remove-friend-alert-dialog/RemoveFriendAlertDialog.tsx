import { Avatar, Card, Flex, Text } from '@radix-ui/themes';
import { HeartCrackIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { FriendUser } from 'api/chipin.types';
import { useRemoveKnownUser } from 'hooks/useUserMutations';

import { UserAvatar } from 'basics';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    friend: FriendUser;
    isOpened: boolean;
    setIsOpened: (isOpen: boolean) => void;
}

const RemoveFriendAlertDialog = ({ friend, isOpened, setIsOpened }: Props) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const { removeKnownUser, isPending: isRemovingFriend } = useRemoveKnownUser();

    // A failure is a toast from the hook; the rejection keeps the dialog open.
    const onRemoveFriend = () =>
        removeKnownUser(friend.id).then(() => {
            toast.success(
                t('toasts:friend.removed', {
                    name: friend.displayName,
                }),
            );
        });

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            title={t('friends:removeModal.title')}
            description={t('friends:removeModal.confirm')}
            actionLabel={t('friends:actions.removeFriend')}
            actionColor="red"
            isActionLoading={isRemovingFriend}
            onAction={onRemoveFriend}
            content={
                <>
                    <Card size="2" variant="surface">
                        <Flex align="center" justify="between" gap="4">
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
                                fallback={<HeartCrackIcon size={20} />}
                            />
                        </Flex>
                    </Card>

                    <Text size="2" color="gray">
                        {t('friends:removeModal.description')}
                    </Text>
                </>
            }
        />
    );
};

export default RemoveFriendAlertDialog;
