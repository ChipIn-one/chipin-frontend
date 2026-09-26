import { useEffect, useState } from 'react';

import { Container } from '@radix-ui/themes';

import { InternalPageColumns } from 'components/internal-page-layout';
import {
    type ActivityFilter,
    ActivityList,
    ActivitySidebar,
} from 'features/activity';

import { useConnect } from './internal/activity-page';

const ActivityPage = () => {
    const { fetchSetActivity, isActivityFetched } = useConnect();
    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

    useEffect(() => {
        if (!isActivityFetched) {
            fetchSetActivity();
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
