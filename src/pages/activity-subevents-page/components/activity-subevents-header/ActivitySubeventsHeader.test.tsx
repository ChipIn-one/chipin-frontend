import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import { ActivitySubeventsHeader } from './ActivitySubeventsHeader';

vi.mock('features/activity', () => ({
    ActivityEvent: () => <div data-testid="parent-event" />,
}));

vi.mock('components/skeletons/activity-event-skeleton', () => ({
    ActivityEventSkeleton: () => <div data-testid="parent-event-skeleton" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const parentEvent = {
    id: 'activity-id',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-id',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: 'expense-id',
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: 'expense-id',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-id',
        payerDisplayName: 'Alex',
        shares: [],
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const renderHeader = (
    event: AppEvent | undefined,
    isLoading = false,
    isUnavailable = false,
) => {
    render(
        <ActivitySubeventsHeader
            parentEvent={event}
            isLoading={isLoading}
            isUnavailable={isUnavailable}
        />,
    );
};

test('renders the parent activity header', () => {
    renderHeader(parentEvent);

    expect(screen.getByTestId('parent-event')).toBeTruthy();
});

test('renders a parent activity skeleton while loading', () => {
    renderHeader(undefined, true);

    expect(screen.getByTestId('parent-event-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('parent-event')).toBeNull();
});

test('shows a localized fallback when the parent activity is unavailable', () => {
    renderHeader(undefined, false, true);

    expect(screen.getByText('subeventsParentUnavailableTitle')).toBeTruthy();
    expect(screen.getByText('subeventsParentUnavailableDescription')).toBeTruthy();
});
