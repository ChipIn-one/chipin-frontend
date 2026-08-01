import { useEffect, useState } from 'react';

import { Container } from '@radix-ui/themes';

import { useActivityStore } from 'store/activity-store';
import { selectActivityFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { InternalPageColumns } from 'components/internal-page-layout';
import {
    type ActivityFilter,
    ActivityList,
    ActivitySidebar,
} from 'features/activity';

const ActivityPage = () => {
    const fetchSetActivity = useActivityStore(s => s.fetchSetActivity);
    const isActivityFetched = useLoadingStore(selectActivityFetched);
    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

    useEffect(() => {
        if (!isActivityFetched) {
            void fetchSetActivity();
        }
    }, [fetchSetActivity, isActivityFetched]);

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumns
                gap={{ initial: '3', lg: '6' }}
                sidePanel={
                    <ActivitySidebar
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                    />
                }
            >
                <ActivityList activeFilter={activeFilter} />
            </InternalPageColumns>
        </Container>
    );
};

export default ActivityPage;
