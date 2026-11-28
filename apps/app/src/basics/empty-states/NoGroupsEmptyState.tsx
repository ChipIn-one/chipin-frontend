import { PROP_COLOR } from '@chipin/tokens/theme';
import { UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoGroupsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('dashboard');

    return (
        <EmptyState
            icon={<UsersIcon size={20} />}
            iconColor={PROP_COLOR.accent}
            title={t('groups.emptyTitle')}
            description={t('groups.emptyDescription')}
            action={action}
            actionPosition={action ? 'below' : 'inline'}
        />
    );
};

export default NoGroupsEmptyState;
