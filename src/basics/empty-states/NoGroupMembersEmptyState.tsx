import { ReactNode } from 'react';
import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoGroupMembersEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('group');

    return (
        <EmptyState
            icon={<LucideUserPlus size={16} />}
            iconColor="teal"
            title={t('page.balances.empty')}
            action={action}
        />
    );
};

export default NoGroupMembersEmptyState;
