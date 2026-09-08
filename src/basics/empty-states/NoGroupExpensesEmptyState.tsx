import { ReactNode } from 'react';
import { LucideReceipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoGroupExpensesEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('group');

    return (
        <EmptyState
            icon={<LucideReceipt size={16} />}
            iconColor="jade"
            title={t('page.expenses.emptyTitle')}
            description={t('page.expenses.emptyDescription')}
            action={action}
        />
    );
};

export default NoGroupExpensesEmptyState;
