import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BaseAlertDialog } from '../base-alert-dialog';

interface Props {
    children: ReactNode;
    isActionLoading: boolean;
    onAction: () => Promise<void>;
}

const RemoveLedgerEntryAlertDialog = ({ children, isActionLoading, onAction }: Props) => {
    const { t } = useTranslation('activity');
    const [isOpened, setIsOpened] = useState(false);

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            triggerElement={children}
            title={t('subeventsDeleteDialogTitle')}
            description={t('subeventsDeleteDialogDescription')}
            actionLabel={t('subeventsDeleteConfirmAction')}
            actionColor="red"
            isActionLoading={isActionLoading}
            onAction={onAction}
        />
    );
};

export default RemoveLedgerEntryAlertDialog;
