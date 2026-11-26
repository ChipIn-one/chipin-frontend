import { ClipboardListIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

// An Activity type filter that leaves nothing to show (EXP-066).
const NoFilteredActivityEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <EmptyState
            icon={<ClipboardListIcon size={20} />}
            iconColor="gray"
            title={t('filteredEmptyTitle')}
            description={t('filteredEmptyDescription')}
            action={action}
        />
    );
};

export { NoFilteredActivityEmptyState };
