import { AppEvent } from 'api/activity.types';

import EventExpenseCreated from './EventExpenseCreated';
import EventGroupCreated from './EventGroupCreated';
import EventGroupDeleted from './EventGroupDeleted';
import EventGroupUpdated from './EventGroupUpdated';
import EventMemberJoin from './EventMemberJoin';
import EventMemberLeft from './EventMemberLeft';
import EventUnknown from './EventUnknown';

interface Props {
    event: AppEvent;
}

const EventRenderer = ({ event }: Props) => {
    switch (event.action) {
        case 'EXPENSE_CREATED':
            return <EventExpenseCreated event={event} />;
        case 'MEMBER_JOINED':
            return <EventMemberJoin event={event} />;
        case 'MEMBER_LEFT':
            return <EventMemberLeft event={event} />;
        case 'GROUP_DELETED':
            return <EventGroupDeleted event={event} />;
        case 'GROUP_CREATED':
            return <EventGroupCreated event={event} />;
        case 'GROUP_UPDATED':
            return <EventGroupUpdated event={event} />;
        default:
            return <EventUnknown event={event} />;
    }
};

export default EventRenderer;
