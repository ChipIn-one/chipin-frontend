import { ReactNode } from 'react';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoActivityEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <EmptyState
            icon={<ClipboardListIcon size={20} />}
            iconColor="gray"
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={action}
        />
    );
};

export default NoActivityEmptyState;
