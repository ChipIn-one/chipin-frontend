import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Container } from '@radix-ui/themes';

import { getActivityCategory } from 'helpers/activityEvent';
import { useActivityStore } from 'store/activity-store';
import {
    selectActivitySelectedEventFetched,
    selectActivitySelectedEventLoading,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { ActivitySubeventsFeed, ActivitySubeventsHeader } from './components';

const ActivitySubeventsPage = () => {
    const { parentActivityId } = useParams<{ parentActivityId: string }>();
    const selectedEvent = useActivityStore(state => state.selectedEvent);
    const fetchSetSelectedEvent = useActivityStore(
        state => state.fetchSetSelectedEvent,
    );
    const isParentLoading = useLoadingStore(
        selectActivitySelectedEventLoading,
    );
    const isParentFetched = useLoadingStore(
        selectActivitySelectedEventFetched,
    );
    const [failedParentId, setFailedParentId] = useState<string | null>(null);
    const parentEvent =
        selectedEvent && selectedEvent.id === parentActivityId
            ? selectedEvent
            : undefined;
    const activityCategory = getActivityCategory(parentEvent);
    const isParentLoadError = failedParentId === parentActivityId;

    useEffect(() => {
        if (
            !parentActivityId ||
            parentEvent ||
            isParentLoading ||
            isParentLoadError
        ) {
            return;
        }

        void fetchSetSelectedEvent(parentActivityId).catch(() => {
            setFailedParentId(parentActivityId);
        });
    }, [
        parentActivityId,
        parentEvent,
        isParentLoading,
        isParentLoadError,
        fetchSetSelectedEvent,
    ]);

    const onRetryParent = () => {
        setFailedParentId(null);
    };

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivitySubeventsHeader
                parentEvent={parentEvent}
                isLoading={
                    isParentLoading ||
                    (!parentEvent && !isParentFetched && !isParentLoadError)
                }
                isError={isParentLoadError}
                onRetry={onRetryParent}
            />

            {!isParentLoadError ? (
                <ActivitySubeventsFeed
                    parentActivityId={parentActivityId}
                    activityCategory={activityCategory}
                />
            ) : null}
        </Container>
    );
};

export default ActivitySubeventsPage;
