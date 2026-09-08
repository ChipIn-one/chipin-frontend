import { ReactNode } from 'react';
import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoFriendsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('friends');

    return (
        <EmptyState
            icon={<LucideUserPlus size={16} />}
            iconColor="cyan"
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={action}
        />
    );
};

export default NoFriendsEmptyState;
