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
}

const ActivityEventsList = ({ events, emptyState = <NoActivityEmptyState />, children }: Props) => {
    const userId = useUsersStore(state => state.user?.id);
    const dailyExpenseSummaries = useMemo(
        () => getDailyExpenseSummaries(events, userId),
        [events, userId],
    );

    if (events.length === 0) {
        return emptyState;
    }

    let previousDateKey: string | null = null;

    return (
        <Flex direction="column" gap="2">
            {events.map(event => {
                const dateKey = getActivityDateKey(event.createdAt);
                const shouldRenderDivider = dateKey !== previousDateKey;
                previousDateKey = dateKey;

                return (
                    <Fragment key={event.id}>
                        {shouldRenderDivider && (
                            <ActivityDateDivider
                                createdAt={event.createdAt}
                                summary={dailyExpenseSummaries[dateKey] ?? []}
                            />
                        )}
                        <EventRenderer event={event} />
                    </Fragment>
                );
            })}

            {children}
        </Flex>
    );
};

export default ActivityEventsList;
