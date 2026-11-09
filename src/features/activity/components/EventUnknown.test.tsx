import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { type SelfUser, usersKeys } from 'entities/users';
import { signInWithSelf } from 'test/selfUser';

import EventUnknown from './EventUnknown';

import 'i18n/index';

const user: SelfUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
};

// Old enough to show a date with a clock time (not "x minutes ago").
const event: AppEvent = {
    id: 'activity-id',
    seq: 1,
    domain: 'GROUP',
    action: ACTIVITY_ACTIONS.GROUP_DEACTIVATED,
    actorSnapshot: { displayName: 'Alex', picture: null },
    subjectType: 'GROUP',
    subjectId: 'group-id',
    createdAt: 1_700_000_000,
};

test('the event time follows a change of the user time format', () => {
    const client = signInWithSelf(user);

    render(<EventUnknown event={event} />);
    expect(screen.getByText(/AM|PM/)).toBeTruthy();

    act(() => {
        client.setQueryData(usersKeys.self(), {
            ...user,
            settings: { ...user.settings, timeFormat: '24h' },
        });
    });

    return waitFor(() => {
        expect(screen.queryByText(/AM|PM/)).toBeNull();
    });
});
