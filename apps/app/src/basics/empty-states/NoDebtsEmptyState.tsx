import { BanknoteXIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoDebtsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('common');

    return (
        <EmptyState
            icon={<BanknoteXIcon size={20} />}
            iconColor="gray"
            title={t('noDebtsTitle')}
            description={t('noDebtsDescription')}
            action={action}
        />
    );
};

export default NoDebtsEmptyState;
