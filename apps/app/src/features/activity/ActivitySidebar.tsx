import { useSelfActivityLog } from 'hooks/useSelfActivity';

import ActivityHeader, { type ActivityFilter } from './ActivityHeader';

interface Props {
    activeFilter: ActivityFilter;
    onFilterChange: (filter: ActivityFilter) => void;
}

const ActivitySidebar = ({ activeFilter, onFilterChange }: Props) => {
    const { isLoading } = useSelfActivityLog();

    return (
        <ActivityHeader
            isLoading={isLoading}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
        />
    );
};

export default ActivitySidebar;
