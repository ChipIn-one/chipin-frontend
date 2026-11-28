import { PROP_COLOR } from '@chipin/tokens/theme';
import { UserPlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoGroupMembersEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('group');

    return (
        <EmptyState
            icon={<UserPlusIcon size={20} />}
            iconColor={PROP_COLOR.accent}
            title={t('page.balances.empty')}
            action={action}
        />
    );
};

export default NoGroupMembersEmptyState;
