import { selectActivityLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import ActivityHeader, { type ActivityFilter } from './ActivityHeader';

interface Props {
    activeFilter: ActivityFilter;
    onFilterChange: (filter: ActivityFilter) => void;
}

const ActivitySidebar = ({ activeFilter, onFilterChange }: Props) => {
    const isLoading = useLoadingStore(selectActivityLoading);

    return (
        <ActivityHeader
            isLoading={isLoading}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
        />
    );
};

export default ActivitySidebar;
