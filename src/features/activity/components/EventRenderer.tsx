import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import EventExpenseCreated from './EventExpenseCreated';
import EventGroupCreated from './EventGroupCreated';
import EventGroupDeleted from './EventGroupDeleted';
import EventGroupUpdated from './EventGroupUpdated';
import EventMemberJoin from './EventMemberJoin';
import EventMemberLeft from './EventMemberLeft';
import EventSettlementCreated from './EventSettlementCreated';
import EventUnknown from './EventUnknown';

interface Props {
    event: AppEvent;
}

const EventRenderer = ({ event }: Props) => {
    switch (event.action) {
        case ACTIVITY_ACTIONS.EXPENSE_CREATED:
            return <EventExpenseCreated event={event} />;
        case ACTIVITY_ACTIONS.SETTLEMENT_CREATED:
            return <EventSettlementCreated event={event} />;
        case ACTIVITY_ACTIONS.MEMBER_JOINED:
            return <EventMemberJoin event={event} />;
        case ACTIVITY_ACTIONS.MEMBER_LEFT:
            return <EventMemberLeft event={event} />;
        case ACTIVITY_ACTIONS.GROUP_DELETED:
            return <EventGroupDeleted event={event} />;
        case ACTIVITY_ACTIONS.GROUP_CREATED:
            return <EventGroupCreated event={event} />;
        case ACTIVITY_ACTIONS.GROUP_UPDATED:
            return <EventGroupUpdated event={event} />;
        default:
            return <EventUnknown event={event} />;
    }
};

export default EventRenderer;
