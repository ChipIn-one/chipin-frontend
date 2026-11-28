import { PROP_COLOR } from '@chipin/tokens/theme';
import { UserPlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

const NoFriendsEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('friends');

    return (
        <EmptyState
            icon={<UserPlusIcon size={20} />}
            iconColor={PROP_COLOR.accent}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={action}
        />
    );
};

export default NoFriendsEmptyState;
