import { useState } from 'react';
import { UserAvatar } from 'basics';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Callout, Dialog, Flex, Select, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
}

const LeaveGroupModal = ({ children }: Props) => {
    const navigate = useNavigate();
    const { leaveGroup, selectedGroup } = useGroupsStore();
    const { user } = useUsersStore();
    const isLeavingGroup = useLoadingStore(selectGroupLeaving);
    const [isModalOpened, setIsModalOpened] = useState(false);
    const [newOwnerId, setNewOwnerId] = useState<string>('');

    const isOwner = !!user && !!selectedGroup && selectedGroup.creator.id === user.id;
    const otherMembers = selectedGroup?.members.filter(m => m.id !== user?.id) ?? [];
    const mustTransfer = isOwner && otherMembers.length > 0;
    const canConfirm = !mustTransfer || !!newOwnerId;

    const onLeaveGroup = () => {
        leaveGroup(mustTransfer ? { newOwnerId } : undefined)
            .then(groupName => {
                setIsModalOpened(false);
                toast.success(t('toasts:group.left', { name: groupName }));
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(() => {
                toast.error(t('toasts:group.leaveError'));
            });
    };

    const onOpenChange = (open: boolean) => {
        setIsModalOpened(open);
        if (!open) {
            setNewOwnerId('');
        }
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={onOpenChange}
            triggerElement={children}
            title={t('group:leaveModal.title')}
            maxWidth="480px"
            content={
                <Flex direction="column" gap="6">
                    {mustTransfer && (
                        <Callout.Root color="amber" size="2">
                            <Callout.Text>{t('group:leaveModal.ownerWarning')}</Callout.Text>
                        </Callout.Root>
                    )}

                    <Text size="4">{t('group:leaveModal.confirm')}</Text>

                    {mustTransfer && (
                        <Select.Root size="3" value={newOwnerId} onValueChange={setNewOwnerId}>
                            <Select.Trigger
                                placeholder={t('group:leaveModal.newOwnerPlaceholder')}
                            />
                            <Select.Content>
                                {otherMembers.map(member => (
                                    <Select.Item key={member.id} value={member.id}>
                                        <Flex align="center" gap="2">
                                            <UserAvatar
                                                size="1"
                                                src={member.picture ?? undefined}
                                                fallback={member.displayName.charAt(0) || '?'}
                                            />
                                            {member.displayName}
                                        </Flex>
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    )}

                    <Flex justify="end" gap="4">
                        <Dialog.Close>
                            <Button size="3" variant="soft" color="gray">
                                {t('buttons.cancel')}
                            </Button>
                        </Dialog.Close>

                        <Button
                            size="3"
                            variant="solid"
                            color="orange"
                            onClick={onLeaveGroup}
                            loading={isLeavingGroup}
                            disabled={!canConfirm}
                        >
                            {t('group:leaveModal.confirmButton')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default LeaveGroupModal;
