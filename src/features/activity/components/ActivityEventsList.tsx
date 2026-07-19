import { Fragment, type ReactNode, useMemo } from 'react';

import { Flex } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { getActivityDateKey } from 'helpers/time';
import { useUsersStore } from 'store/usersStore';

import { NoActivityEmptyState } from 'basics/empty-states';

import { getDailyExpenseSummaries } from '../selectors';

import ActivityDateDivider from './ActivityDateDivider';
import EventRenderer from './EventRenderer';

interface Props {
    events: AppEvent[];
    emptyState?: ReactNode;
    children?: ReactNode;
    hasDailySummary?: boolean;
    isActivityLinkEnabled?: boolean;
}

const ActivityEventsList = ({
    events,
    emptyState = <NoActivityEmptyState />,
    children,
    hasDailySummary = false,
    isActivityLinkEnabled = false,
}: Props) => {
    const userId = useUsersStore(state => state.user?.id);
    const dailyExpenseSummaries = useMemo(
        () => (hasDailySummary ? getDailyExpenseSummaries(events, userId) : {}),
        [events, hasDailySummary, userId],
    );

    if (events.length === 0) {
        return emptyState;
    }

    return (
        <Flex direction="column" gap="2">
            {events.map((event, index) => {
                const dateKey = getActivityDateKey(event.createdAt);
                const previousEvent = events[index - 1];
                const shouldRenderDivider =
                    previousEvent === undefined ||
                    dateKey !== getActivityDateKey(previousEvent.createdAt);

                return (
                    <Fragment key={event.id}>
                        {shouldRenderDivider && (
                            <ActivityDateDivider
                                createdAt={event.createdAt}
                                summary={dailyExpenseSummaries[dateKey] ?? []}
                            />
                        )}
                        <EventRenderer
                            event={event}
                            isActivityLinkEnabled={isActivityLinkEnabled}
                        />
                    </Fragment>
                );
            })}

            {children}
        </Flex>
    );
};

export default ActivityEventsList;
