import { useEffect, useState } from 'react';

import { Box, Container, Grid } from '@radix-ui/themes';

import { useActivityStore } from 'store/activity-store';
import { selectActivityFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { MobileNavBar } from 'components/nav-bars';
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
            <Grid columns="3" gap={{ initial: '3', lg: '6' }}>
                <Box gridColumn={{ initial: 'span 3', lg: 'span 1' }}>
                    <ActivitySidebar
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                    />
                </Box>

                <Box gridColumn={{ initial: 'span 3', lg: 'span 2' }}>
                    <ActivityList activeFilter={activeFilter} />
                </Box>
            </Grid>
            <MobileNavBar />
        </Container>
    );
};

export default ActivityPage;
