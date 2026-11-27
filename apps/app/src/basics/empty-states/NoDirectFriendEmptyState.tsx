import { PROP_COLOR } from '@chipin/tokens/theme';
import { UserPlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    action?: ReactNode;
}

/** KB EXP-067: a direct expense with no mutual known user yet; the action is the invite. */
const NoDirectFriendEmptyState = ({ action }: Props) => {
    const { t } = useTranslation('group');

    return (
        <EmptyState
            icon={<UserPlusIcon size={20} />}
            iconColor={PROP_COLOR.info}
            title={t('expenses.modal.directNoFriend.title')}
            description={t('expenses.modal.directNoFriend.description')}
            action={action}
            actionPosition={action ? 'below' : 'inline'}
        />
    );
};

export { NoDirectFriendEmptyState };
