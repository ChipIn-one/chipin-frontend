import { ReactNode } from 'react';
import { LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoGroupsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('dashboard');

    return (
        <EmptyState
            icon={<LucideUsers size={20} />}
            iconColor="indigo"
            title={t('groups.emptyTitle')}
            description={t('groups.emptyDescription')}
            action={action}
            density="groupCard"
        />
    );
};

export default NoGroupsEmptyState;
