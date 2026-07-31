import { type ReactNode, useState } from 'react';
import { UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Callout, Flex } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import Select, { type SelectItem } from 'components/Select';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
}

const LeaveGroupAlertDialog = ({ children }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const navigate = useNavigate();
    const selectedGroup = useGroupsStore(state => state.selectedGroup);
    const leaveGroup = useGroupsStore(state => state.leaveGroup);
    const user = useUsersStore(state => state.user);
    const isLeavingGroup = useLoadingStore(selectGroupLeaving);
    const [isOpened, setIsOpened] = useState(false);
    const [newOwnerId, setNewOwnerId] = useState('');
    const isOwner = Boolean(user && selectedGroup && selectedGroup.creator.id === user.id);
    const ownerItems: SelectItem[] = [];
    const membersById = new Map<string, NonNullable<typeof selectedGroup>['members'][number]>();

    if (selectedGroup) {
        for (const member of selectedGroup.members) {
            if (member.user.id === user?.id) {
                continue;
            }

            membersById.set(member.user.id, member);
            ownerItems.push({
                value: member.user.id,
                label: member.user.displayName,
            });
        }
    }

    const mustTransfer = isOwner && ownerItems.length > 0;
    const canConfirm = !mustTransfer || Boolean(newOwnerId);

    const onLeaveGroup = () => {
        return leaveGroup(mustTransfer ? { newOwnerId } : undefined)
            .then(groupName => {
                toast.success(t('toasts:group.left', { name: groupName }));
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(error => {
                toast.error(t('toasts:group.leaveError'));
                return Promise.reject(error);
            });
    };

    const onOpenChange = (isOpen: boolean) => {
        setIsOpened(isOpen);

        if (!isOpen) {
            setNewOwnerId('');
        }
    };

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={onOpenChange}
            triggerElement={children}
            title={t('common:buttons.leaveGroup')}
            description={t('group:leaveModal.confirm')}
            actionLabel={t('common:buttons.leaveGroup')}
            actionColor="orange"
            isActionDisabled={!canConfirm}
            isActionLoading={isLeavingGroup}
            onAction={onLeaveGroup}
            content={
                mustTransfer ? (
                    <Flex direction="column" gap="4">
                        <Callout.Root color="amber" size="2">
                            <Callout.Text>
                                {t('group:leaveModal.ownerWarning')}
                            </Callout.Text>
                        </Callout.Root>

                        <Select
                            items={ownerItems}
                            size="3"
                            value={newOwnerId}
                            onChange={setNewOwnerId}
                            placeholder={t('group:leaveModal.newOwnerPlaceholder')}
                            renderItem={item => {
                                const member = membersById.get(item.value);

                                if (!member) {
                                    return item.label;
                                }

                                return (
                                    <Flex align="center" gap="2">
                                        <UserAvatar size="1" user={member.user} />
                                        {member.user.displayName}
                                    </Flex>
                                );
                            }}
                            renderValue={item => {
                                const member = item ? membersById.get(item.value) : undefined;

                                if (!member) {
                                    return undefined;
                                }

                                return (
                                    <Flex align="center" gap="2">
                                        <UserAvatar size="1" user={member.user} />
                                        {member.user.displayName}
                                    </Flex>
                                );
                            }}
                        />
                    </Flex>
                ) : undefined
            }
        />
    );
};

export default LeaveGroupAlertDialog;
