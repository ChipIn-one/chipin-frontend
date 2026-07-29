import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { buildActivitySubeventsRoute } from 'helpers/url';
import { useActivityStore } from 'store/activity-store';

import { EventExpense } from '../event-expense';
import { EventExpenseTransferred } from '../event-expense-transferred';
import { EventMemberKicked } from '../event-member-kicked';
import { EventSettlement } from '../event-settlement';
import EventGroupCreated from '../EventGroupCreated';
import EventGroupDeleted from '../EventGroupDeleted';
import EventGroupUpdated from '../EventGroupUpdated';
import EventMemberJoin from '../EventMemberJoin';
import EventMemberLeft from '../EventMemberLeft';
import EventUnknown from '../EventUnknown';

import { ActivityEventLink } from './styled';

interface Props {
    event: AppEvent;
    isNavigable?: boolean;
}

const ActivityEvent = ({ event, isNavigable = true }: Props) => {
    const setSelectedEvent = useActivityStore(state => state.setSelectedEvent);
    const onSelectEvent = () => {
        setSelectedEvent(event);
    };

    switch (event.action) {
        case ACTIVITY_ACTIONS.EXPENSE_CREATED:
        case ACTIVITY_ACTIONS.EXPENSE_REVERSED: {
            const expenseCard = <EventExpense event={event} />;

            return isNavigable &&
                event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ? (
                <ActivityEventLink
                    to={buildActivitySubeventsRoute(event.id)}
                    onClick={onSelectEvent}
                    unsetStyles
                >
                    {expenseCard}
                </ActivityEventLink>
            ) : (
                expenseCard
            );
        }
        case ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM:
        case ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_TO:
            return <EventExpenseTransferred event={event} />;
        case ACTIVITY_ACTIONS.SETTLEMENT_CREATED:
        case ACTIVITY_ACTIONS.SETTLEMENT_REVERSED: {
            const settlementCard = <EventSettlement event={event} />;

            return isNavigable &&
                event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED ? (
                <ActivityEventLink
                    to={buildActivitySubeventsRoute(event.id)}
                    onClick={onSelectEvent}
                    unsetStyles
                >
                    {settlementCard}
                </ActivityEventLink>
            ) : (
                settlementCard
            );
        }
        case ACTIVITY_ACTIONS.MEMBER_JOINED:
            return <EventMemberJoin event={event} />;
        case ACTIVITY_ACTIONS.MEMBER_KICKED:
            return <EventMemberKicked event={event} />;
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

export { ActivityEvent };
