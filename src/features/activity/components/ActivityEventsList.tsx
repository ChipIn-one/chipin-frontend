import type { ReactNode } from 'react';

import { Flex } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';

import { NoActivityEmptyState } from 'basics/empty-states';

import EventRenderer from './EventRenderer';

interface Props {
    events: AppEvent[];
    emptyState?: ReactNode;
    children?: ReactNode;
}

const ActivityEventsList = ({ events, emptyState = <NoActivityEmptyState />, children }: Props) => {
    if (events.length === 0) {
        return emptyState;
    }

    return (
        <Flex direction="column" gap="2">
            {events.map(event => (
                <EventRenderer key={event.id} event={event} />
            ))}

            {children}
        </Flex>
    );
};

export default ActivityEventsList;
