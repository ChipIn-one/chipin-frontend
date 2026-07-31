import { type ReactNode, useState } from 'react';
import { LucideTriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Callout } from '@radix-ui/themes';

import type { GroupUser } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupKicking } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
    member: GroupUser;
}

const KickGroupMemberAlertDialog = ({ children, member }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const kickGroupMember = useGroupsStore(state => state.kickGroupMember);
    const isKickingMember = useLoadingStore(selectGroupKicking);
    const [isOpened, setIsOpened] = useState(false);

    const onKickGroupMember = () => {
        return kickGroupMember({ userId: member.id })
            .then(memberDisplayName => {
                toast.success(t('toasts:group.kicked', { name: memberDisplayName }));
            })
            .catch(error => {
                toast.error(t('toasts:group.kickError'));
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
                        <LucideTriangleAlert size={18} />
                    </Callout.Icon>
                    <Callout.Text>
                        {t('group:kickModal.transferExpensesWarning')}
                    </Callout.Text>
                </Callout.Root>
            }
        />
    );
};

export default KickGroupMemberAlertDialog;
