import { type ReactNode, useState } from 'react';
import { Callout } from '@radix-ui/themes';
import { OctagonAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import type { Group } from 'entities/groups';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupRemoving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
    group: Group;
}

const RemoveGroupAlertDialog = ({ children, group }: Props) => {
    const { t } = useTranslation(['common', 'group', 'toasts']);
    const navigate = useNavigate();
    const isRemovingGroup = useLoadingStore(selectGroupRemoving);
    const [isOpened, setIsOpened] = useState(false);

    const onRemoveGroup = () => {
        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                toast.success(
                    t('toasts:group.removed', {
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
                        <OctagonAlertIcon size={20} />
                    </Callout.Icon>
                    <Callout.Text>{t('group:removeModal.warning')}</Callout.Text>
                </Callout.Root>
            }
        />
    );
};

export default RemoveGroupAlertDialog;
