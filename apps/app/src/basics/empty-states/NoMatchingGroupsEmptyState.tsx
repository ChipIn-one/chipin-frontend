import { FilterXIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    /** A search query is active: the description names the query, not the debt filter. */
    hasSearchQuery: boolean;
    action?: ReactNode;
}

// A group-list debt filter or search that matches nothing (DSH-006).
const NoMatchingGroupsEmptyState = ({ hasSearchQuery, action }: Props) => {
    const { t } = useTranslation('dashboard');

    return (
        <EmptyState
            icon={<FilterXIcon size={16} />}
            title={t('groups.filterEmptyTitle')}
            description={
                hasSearchQuery
                    ? t('groups.searchEmptyDescription')
                    : t('groups.filterEmptyDescription')
            }
            action={action}
        />
    );
};

export { NoMatchingGroupsEmptyState };
