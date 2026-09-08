import { ReactNode } from 'react';
import { LucideClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoActivityEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <EmptyState
            icon={<LucideClipboardList size={16} />}
            iconColor="gray"
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={action}
        />
    );
};

export default NoActivityEmptyState;
