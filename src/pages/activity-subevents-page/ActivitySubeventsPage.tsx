import { useParams } from 'react-router-dom';

import { Container } from '@radix-ui/themes';

import { getActivityCategory } from 'helpers/activityEvent';
import { useActivityStore } from 'store/activity-store';
import { selectActivitySubeventsLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { ActivitySubeventsFeed, ActivitySubeventsHeader } from './components';

const ActivitySubeventsPage = () => {
    const { parentActivityId } = useParams<{ parentActivityId: string }>();
    const parentEvent = useActivityStore(state => {
        const parent = state.subeventsParent;

        return parent && parent.id === parentActivityId ? parent : undefined;
    });
    const isLoading = useLoadingStore(selectActivitySubeventsLoading);
    const activityCategory = getActivityCategory(parentEvent);
    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivitySubeventsHeader
                parentEvent={parentEvent}
                isLoading={isLoading}
                isUnavailable={!isLoading && !parentEvent}
            />

            <ActivitySubeventsFeed
                parentActivityId={parentActivityId}
                activityCategory={activityCategory}
            />
        </Container>
    );
};

export default ActivitySubeventsPage;
