import styled from 'styled-components';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { buildActivityChildrenRoute } from 'constants/routes';

import { NavButton } from 'basics/buttons';

import EventExpenseCreated from './EventExpenseCreated';
import EventExpenseReversed from './EventExpenseReversed';
import EventGroupCreated from './EventGroupCreated';
import EventGroupDeleted from './EventGroupDeleted';
import EventGroupUpdated from './EventGroupUpdated';
import EventMemberJoin from './EventMemberJoin';
import EventMemberLeft from './EventMemberLeft';
import EventSettlementCreated from './EventSettlementCreated';
import EventSettlementReversed from './EventSettlementReversed';
import EventUnknown from './EventUnknown';

const EventNavButton = styled(NavButton)`
    display: block;
    width: 100%;
`;

interface Props {
    event: AppEvent;
    isActivityLinkEnabled?: boolean;
}

const EventRenderer = ({ event, isActivityLinkEnabled = false }: Props) => {
    switch (event.action) {
        case ACTIVITY_ACTIONS.EXPENSE_CREATED: {
            const expenseCard = <EventExpenseCreated event={event} />;

            return isActivityLinkEnabled ? (
                <EventNavButton
                    to={buildActivityChildrenRoute(event.id)}
                    state={{ parentActivityEvent: event }}
                    unsetStyles
                >
                    {expenseCard}
                </EventNavButton>
            ) : (
                expenseCard
            );
        }
        case ACTIVITY_ACTIONS.EXPENSE_REVERSED:
            return <EventExpenseReversed event={event} />;
        case ACTIVITY_ACTIONS.SETTLEMENT_CREATED: {
            const settlementCard = <EventSettlementCreated event={event} />;

            return isActivityLinkEnabled ? (
                <EventNavButton
                    to={buildActivityChildrenRoute(event.id)}
                    state={{ parentActivityEvent: event }}
                    unsetStyles
                >
                    {settlementCard}
                </EventNavButton>
            ) : (
                settlementCard
            );
        }
        case ACTIVITY_ACTIONS.SETTLEMENT_REVERSED:
            return <EventSettlementReversed event={event} />;
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
