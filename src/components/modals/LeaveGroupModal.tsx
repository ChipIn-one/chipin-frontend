import { useState } from 'react';
import { UserAvatar } from 'basics';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import Select, { SelectItem } from 'components/Select';

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
    const ownerItems: SelectItem[] = otherMembers.map(member => {
        return {
            value: member.id,
            label: member.displayName,
        };
    });

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
            title={t('common:buttons.leaveGroup')}
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
                        <Select
                            items={ownerItems}
                            size="3"
                            value={newOwnerId}
                            onChange={setNewOwnerId}
                            placeholder={t('group:leaveModal.newOwnerPlaceholder')}
                            renderItem={item => {
                                const member = otherMembers.find(
                                    otherMember => otherMember.id === item.value,
                                );

                                if (!member) {
                                    return item.label;
                                }

                                return (
                                    <Flex align="center" gap="2">
                                        <UserAvatar
                                            size="1"
                                            src={member.picture ?? undefined}
                                            fallback={member.displayName.charAt(0) || '?'}
                                        />
                                        {member.displayName}
                                    </Flex>
                                );
                            }}
                            renderValue={item => {
                                const member = otherMembers.find(
                                    otherMember => otherMember.id === item?.value,
                                );

                                if (!member) {
                                    return undefined;
                                }

                                return (
                                    <Flex align="center" gap="2">
                                        <UserAvatar
                                            size="1"
                                            src={member.picture ?? undefined}
                                            fallback={member.displayName.charAt(0) || '?'}
                                        />
                                        {member.displayName}
                                    </Flex>
                                );
                            }}
                        />
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
                            {t('common:buttons.leaveGroup')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default LeaveGroupModal;
