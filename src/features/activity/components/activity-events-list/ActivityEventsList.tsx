import { Fragment, type ReactNode, useMemo } from 'react';

import { Flex } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { getActivityDateKey } from 'helpers/time';
import { useUsersStore } from 'store/users-store';

import { NoActivityEmptyState } from 'basics/empty-states';

import { selectors } from '../../internal';
import { ActivityEvent } from '../activity-event';
import ActivityDateDivider from '../ActivityDateDivider';

interface Props {
    events: AppEvent[];
    emptyState?: ReactNode;
    children?: ReactNode;
    isShowSummary?: boolean;
    isNavigable?: boolean;
}

const ActivityEventsList = ({
    events,
    emptyState = <NoActivityEmptyState />,
    children,
    isShowSummary = false,
    isNavigable = false,
}: Props) => {
    const userId = useUsersStore(state => state.user?.id);
    const dailyExpenseSummaries = useMemo(
        () => (isShowSummary ? selectors.getDailyExpenseSummary(events, userId) : {}),
        [events, isShowSummary, userId],
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
                        <ActivityEvent event={event} isNavigable={isNavigable} />
                    </Fragment>
                );
            })}

            {children}
        </Flex>
    );
};

export { ActivityEventsList };
