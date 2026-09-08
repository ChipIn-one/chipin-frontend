import { type ReactNode, useState } from 'react';
import { LucideOctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Callout } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
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
    const isRemovingGroup = useLoadingStore(selectGroupRemoving);
    const [isOpened, setIsOpened] = useState(false);

    const onRemoveGroup = () => {
        const { removeGroup, selectedGroup } = useGroupsStore.getState();

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        return removeGroup({ groupId: selectedGroup.id })
            .then(() => {
                toast.success(t('toasts:group.removed', {
                    name: selectedGroup.name,
                }));
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(error => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('toasts:common.requestFailed'),
                ));
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
