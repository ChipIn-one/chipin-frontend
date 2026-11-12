import { useState } from 'react';
import { Container } from '@radix-ui/themes';

import { type ActivityFilter, ActivityList, ActivitySidebar } from 'features/activity';

import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

const ActivityPage = () => {
    const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

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
