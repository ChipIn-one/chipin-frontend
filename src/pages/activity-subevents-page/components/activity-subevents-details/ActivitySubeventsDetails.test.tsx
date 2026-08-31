import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import type { ActivitySubeventsView } from 'helpers/activityEvent';

import { ActivitySubeventsDetails } from './ActivitySubeventsDetails';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    getI18n: () => ({ language: 'en' }),
}));

vi.mock('basics', () => ({
    Amount: ({ value, tokenCode }: { value: number; tokenCode: string }) => (
        <span>{value} {tokenCode}</span>
    ),
    LedgerScopeBadge: ({ groupName }: { groupName?: string | null }) => (
        <span>{groupName ?? 'Direct'}</span>
    ),
}));

vi.mock('../activity-subevents-buttons', () => ({
    ActivitySubeventsButtons: () => <div data-testid="subevents-buttons" />,
}));

const expenseCreated = {
    id: 'expense-created',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: { displayName: 'Alex', picture: null },
    subjectType: 'expense',
    subjectId: 'expense-1',
    groupId: 'group-1',
    metadata: {
        type: 'expense',
        entryId: 'expense-1',
        groupId: 'group-1',
        groupName: 'Weekend trip',
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        category: 'food',
        subcategory: 'restaurants',
        payerId: 'user-1',
        payerDisplayName: 'Alex',
        sharingMode: { type: 'EXACT' as const, customShares: { 'user-1': 15, 'user-2': 15 } },
        shares: [
            { userId: 'user-1', displayName: 'Alex', shareAmount: 15, currency: 'USD' },
            { userId: 'user-2', displayName: 'Sam', shareAmount: 15, currency: 'USD' },
        ],
    },
    createdAt: 1_700_000_000,
    parentActivityId: null,
} satisfies AppEvent;

const expenseUpdated = {
    ...expenseCreated,
    id: 'expense-updated',
    seq: 2,
    createdAt: 1_800_000_000,
    action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    metadata: {
        ...expenseCreated.metadata,
        description: 'Updated dinner',
        amount: 40,
    },
    parentActivityId: expenseCreated.id,
} satisfies AppEvent;

const settlementCreated = {
    id: 'settlement-created',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: { displayName: 'Alex', picture: null },
    subjectType: 'settlement',
    subjectId: 'settlement-1',
    groupId: 'group-1',
    metadata: {
        type: 'settlement',
        entryId: 'settlement-1',
        groupId: 'group-1',
        groupName: 'Weekend trip',
        amount: 20,
        currency: 'USD',
        payerId: 'user-1',
        fromDisplayName: 'Alex',
        toDisplayName: 'Sam',
    },
    createdAt: 1_700_000_000,
    parentActivityId: null,
} satisfies AppEvent;

const createView = (
    originalEvent: AppEvent,
    currentEvent: AppEvent = originalEvent,
): ActivitySubeventsView => ({ originalEvent, currentEvent });

test('shows current expense details from the latest snapshot', () => {
    render(
        <ActivitySubeventsDetails
            view={createView(expenseCreated, expenseUpdated)}
            isLoading={false}
        />,
    );

    expect(screen.getAllByText('subeventsCurrentStateTitle')).not.toHaveLength(0);
    expect(screen.getAllByText('Updated dinner')).not.toHaveLength(0);
    expect(screen.getAllByText('40 USD')).not.toHaveLength(0);
    expect(screen.getAllByText('Alex')).not.toHaveLength(0);
    expect(screen.getAllByText('Sam')).not.toHaveLength(0);
    expect(screen.getAllByText('Weekend trip')).not.toHaveLength(0);
    expect(screen.getAllByText('subeventsSharingModes.exact')).not.toHaveLength(0);
    expect(screen.getAllByText('subeventsCreatedAt')).not.toHaveLength(0);
    expect(screen.getAllByText('November 15, 2023')).not.toHaveLength(0);
    expect(screen.getAllByTestId('subevents-buttons')).not.toHaveLength(0);
});

test('shows settlement direction without an expense participant list', () => {
    render(
        <ActivitySubeventsDetails
            view={createView(settlementCreated)}
            isLoading={false}
        />,
    );

    expect(screen.getAllByText('subeventsFrom')).not.toHaveLength(0);
    expect(screen.getAllByText('subeventsTo')).not.toHaveLength(0);
    expect(screen.getAllByText('Alex')).not.toHaveLength(0);
    expect(screen.getAllByText('Sam')).not.toHaveLength(0);
    expect(screen.queryByText('subeventsParticipants')).toBeNull();
});

test('keeps the mobile details disclosure collapsed until requested', async () => {
    const user = userEvent.setup();
    const view = render(
        <ActivitySubeventsDetails
            view={createView(expenseCreated)}
            isLoading={false}
        />,
    );
    const details = view.container.querySelector('details');
    const summary = view.container.querySelector('summary');

    if (!details || !summary) {
        return Promise.reject(new Error('Mobile details disclosure is unavailable'));
    }

    expect(details.open).toBe(false);

    await user.click(summary);

    expect(details.open).toBe(true);
});
