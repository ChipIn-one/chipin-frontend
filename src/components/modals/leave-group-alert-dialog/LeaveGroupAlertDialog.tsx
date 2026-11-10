import { type ReactNode, useState } from 'react';
import { Callout, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import type { Group } from 'entities/groups';
import { resolveApiErrorMessageFromError } from 'helpers/errors';

import { UserAvatar } from 'basics';
import Select, { type SelectItem } from 'components/Select';

import { BaseAlertDialog } from '../base-alert-dialog';

import { useConnect } from './internal';

interface Props {
    children: ReactNode;
    group: Group;
}

const LeaveGroupAlertDialog = ({ children, group }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const navigate = useNavigate();
    const { leaveGroup, user, isLeavingGroup } = useConnect();
    const [isOpened, setIsOpened] = useState(false);
    const [newOwnerId, setNewOwnerId] = useState('');
    const isOwner = Boolean(user && group.creator.id === user.id);
    const ownerItems: SelectItem[] = [];
    const membersById = new Map<string, Group['members'][number]>();

    for (const member of group.members) {
        if (member.user.id === user?.id) {
            continue;
        }

        membersById.set(member.user.id, member);
        ownerItems.push({
            value: member.user.id,
            label: member.user.displayName,
        });
    }

    const mustTransfer = isOwner && ownerItems.length > 0;
    const canConfirm = !mustTransfer || Boolean(newOwnerId);

    const onLeaveGroup = () => {
        return leaveGroup({
            groupId: group.id,
            ...(mustTransfer && { newOwnerId }),
        })
            .then(() => {
                toast.success(
                    t('toasts:group.left', {
                        name: group.name,
                    }),
                );
                void navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(error => {
                toast.error(
                    resolveApiErrorMessageFromError(error, t('toasts:common.requestFailed')),
                );
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
                            <Callout.Text>{t('group:leaveModal.ownerWarning')}</Callout.Text>
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
