import { ReactNode } from 'react';
import { LucideBanknoteX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoDebtsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('common');

    return (
        <EmptyState
            icon={<LucideBanknoteX size={16} />}
            iconColor="gray"
            title={t('noDebtsTitle')}
            description={t('noDebtsDescription')}
            action={action}
        />
    );
};

export default NoDebtsEmptyState;
