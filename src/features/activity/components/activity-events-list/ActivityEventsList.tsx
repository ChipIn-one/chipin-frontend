import { Fragment, type ReactNode, useMemo } from 'react';

import { Flex } from '@radix-ui/themes';

import { isActivityPreview, type ActivityListItem } from 'helpers/activityEvent';
import { getActivityDateKey } from 'helpers/time';
import { useUsersStore } from 'store/users-store';

import { NoActivityEmptyState } from 'basics/empty-states';

import { selectors } from '../../internal';
import { ActivityEvent, FullActivityFeedContext } from '../activity-event';
import ActivityDateDivider from '../ActivityDateDivider';

interface Props {
    events: ActivityListItem[];
    emptyState?: ReactNode;
    children?: ReactNode;
    isShowSummary?: boolean;
    isNavigable?: boolean;
    isFullActivityFeed?: boolean;
}

const ActivityEventsList = ({
    events,
    emptyState = <NoActivityEmptyState />,
    children,
    isShowSummary = false,
    isNavigable = false,
    isFullActivityFeed = false,
}: Props) => {
    const userId = useUsersStore(state => state.user?.id);
    const dailyExpenseSummaries = useMemo(
        () => (isShowSummary ? selectors.getDailyExpenseSummary(events, userId) : {}),
        [events, isShowSummary, userId],
    );

    if (events.length === 0) {
        // Pagination/retry controls must remain mounted when a preview page filters to empty.
        return <>{emptyState}{children}</>;
    }

    return (
        <FullActivityFeedContext.Provider value={isFullActivityFeed}>
            <Flex direction="column" gap="2">
                {events.map((item, index) => {
                    const isPreview = isActivityPreview(item);
                    const originalEvent = isPreview ? item.parent : item;
                    const event = isPreview ? item.lastEvent : item;
                    const dateKey = getActivityDateKey(originalEvent.createdAt);
                    const previousItem = events[index - 1];
                    const previousEvent = previousItem && (
                        isActivityPreview(previousItem) ? previousItem.parent : previousItem
                    );
                    const shouldRenderDivider =
                        previousEvent === undefined ||
                        dateKey !== getActivityDateKey(previousEvent.createdAt);

                    return (
                        <Fragment key={originalEvent.id}>
                            {shouldRenderDivider && (
                                <ActivityDateDivider
                                    createdAt={originalEvent.createdAt}
                                    summary={dailyExpenseSummaries[dateKey] ?? []}
                                />
                            )}
                            <ActivityEvent
                                event={event}
                                parentActivityId={isPreview ? originalEvent.id : undefined}
                                isNavigable={isNavigable}
                            />
                        </Fragment>
                    );
                })}

                {children}
            </Flex>
        </FullActivityFeedContext.Provider>
    );
};

export { ActivityEventsList };
