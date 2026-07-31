import { type ReactNode, useState } from 'react';
import { LucideOctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Callout } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupRemoving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
}

const RemoveGroupAlertDialog = ({ children }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const navigate = useNavigate();
    const removeGroup = useGroupsStore(state => state.removeGroup);
    const isRemovingGroup = useLoadingStore(selectGroupRemoving);
    const [isOpened, setIsOpened] = useState(false);

    const onRemoveGroup = () => {
        return removeGroup()
            .then(groupName => {
                toast.success(t('toasts:group.removed', { name: groupName }));
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(error => {
                toast.error(t('toasts:group.removeError'));
                return Promise.reject(error);
            });
    };

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            triggerElement={children}
            title={t('group:removeModal.title')}
            description={t('group:removeModal.confirm')}
            actionLabel={t('common:buttons.delete')}
            actionColor="red"
            isActionLoading={isRemovingGroup}
            onAction={onRemoveGroup}
            content={
                <Callout.Root color="red" size="2">
                    <Callout.Icon>
                        <LucideOctagonAlert size={20} />
                    </Callout.Icon>
                    <Callout.Text>{t('group:removeModal.warning')}</Callout.Text>
                </Callout.Root>
            }
        />
    );
};

export default RemoveGroupAlertDialog;
