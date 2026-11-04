import { useEffect, useState } from 'react';
import { Container } from '@radix-ui/themes';

import { type ActivityFilter, ActivityList, ActivitySidebar } from 'features/activity';

import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

import { useConnect } from './internal/activity-page';

const ActivityPage = () => {
    const { fetchSetActivity, isActivityFetched } = useConnect();
    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

    useEffect(() => {
        if (!isActivityFetched) {
            void fetchSetActivity();
        }
    }, [fetchSetActivity, isActivityFetched]);

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm
                sidePanel={
                    <ActivitySidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                }
            >
                <ActivityList activeFilter={activeFilter} />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default ActivityPage;
