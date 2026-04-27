import { ReactElement } from 'react';

import { AppEvent } from 'api/activity.types';

import EventExpenseCreated from './EventExpenseCreated';
import EventGroupCreated from './EventGroupCreated';
import EventGroupDeleted from './EventGroupDeleted';
import EventGroupUpdated from './EventGroupUpdated';
import EventMemberJoin from './EventMemberJoin';
import EventMemberLeft from './EventMemberLeft';

const renderSpecialEvent = (event: AppEvent): ReactElement | null => {
    if (event.action === 'EXPENSE_CREATED') {
        return <EventExpenseCreated key={event.id} event={event} />;
    }

    if (event.action === 'MEMBER_JOINED') {
        return <EventMemberJoin key={event.id} event={event} />;
    }

    if (event.action === 'MEMBER_LEFT') {
        return <EventMemberLeft key={event.id} event={event} />;
    }

    if (event.action === 'GROUP_DELETED') {
        return <EventGroupDeleted key={event.id} event={event} />;
    }

    if (event.action === 'GROUP_CREATED') {
        return <EventGroupCreated key={event.id} event={event} />;
    }

    if (event.action === 'GROUP_UPDATED') {
        return <EventGroupUpdated key={event.id} event={event} />;
    }

    return null;
};

export default renderSpecialEvent;
