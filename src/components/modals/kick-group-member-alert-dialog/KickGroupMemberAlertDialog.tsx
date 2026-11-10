import { type ReactNode, useState } from 'react';
import { Callout } from '@radix-ui/themes';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { GroupUser } from 'api/chipin.types';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useKickGroupMember } from 'hooks/useGroupMutations';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
    groupId: string;
    member: GroupUser;
}

const KickGroupMemberAlertDialog = ({ children, groupId, member }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const { kickGroupMember, isPending: isKickingMember } = useKickGroupMember();
    const [isOpened, setIsOpened] = useState(false);

    const onKickGroupMember = () => {
        return kickGroupMember({ groupId, userId: member.id })
            .then(() => {
                toast.success(
                    t('toasts:group.kicked', {
                        name: member.displayName,
                    }),
                );
            })
            .catch(error => {
                toast.error(
                    resolveApiErrorMessageFromError(error, t('toasts:common.requestFailed')),
                );
                return Promise.reject(error);
            });
    };

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            triggerElement={children}
            title={t('group:kickModal.title')}
            description={t('group:kickModal.confirm', { name: member.displayName })}
            actionLabel={t('common:buttons.kickMember')}
            actionColor="orange"
            isActionLoading={isKickingMember}
            onAction={onKickGroupMember}
            content={
                <Callout.Root color="amber" size="2">
                    <Callout.Icon>
                        <TriangleAlertIcon size={18} />
                    </Callout.Icon>
                    <Callout.Text>{t('group:kickModal.transferExpensesWarning')}</Callout.Text>
                </Callout.Root>
            }
        />
    );
};

export default KickGroupMemberAlertDialog;
