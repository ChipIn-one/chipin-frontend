import { useEffect } from 'react';

import { Container } from '@radix-ui/themes';

import { useActivityStore } from 'store/activityStore';
import { selectActivityFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import MobileNavBar from 'components/nav-bars/MobileNavBar';
import Activity from 'features/activity';

const ActivityPage = () => {
    const { fetchSetActivity } = useActivityStore();
    const isActivityFetched = useLoadingStore(selectActivityFetched);

    useEffect(() => {
        if (!isActivityFetched) {
            fetchSetActivity();
        }
    }, []);

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Activity context="full" />

            <MobileNavBar />
        </Container>
    );
};

export default ActivityPage;
