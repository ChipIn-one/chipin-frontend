import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import { ActivityEvent } from './ActivityEvent';

vi.mock('basics', () => ({
    RelativeTime: () => <time />,
    UserAvatar: () => <span />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../event-expense', () => ({
    EventExpense: () => <article data-testid="expense-event" />,
}));

vi.mock('../event-settlement', () => ({
    EventSettlement: () => <article data-testid="settlement-event" />,
}));

vi.mock('./styled', () => ({
    ActivityEventLink: ({
        children,
        to,
        onClick,
    }: {
        children: ReactNode;
        to: string;
        onClick?: () => void;
    }) => (
        <a
            href={to}
            onClick={event => {
                event.preventDefault();
                onClick?.();
            }}
        >
            {children}
        </a>
    ),
}));

const baseEvent = {
    id: 'activity-id',
    seq: 748,
    actorUserId: 'actor-id',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectId: 'subject-id',
    groupId: null,
    createdAt: 1785328628,
    parentActivityId: null,
};

const transferMetadata = {
    type: 'expense_transfer' as const,
    groupId: 'group-id',
    groupName: 'Trip',
    transferredUserId: 'transferred-user-id',
    actorUserId: 'actor-id',
    reason: 'KICK' as const,
    transfers: [
        {
            debtorId: 'debtor-id',
            creditorId: 'creditor-id',
            amount: 62,
            currency: 'AMD',
            groupSettlementEntryId: 'settlement-entry-id',
            directExpenseEntryId: 'expense-entry-id',
        },
    ],
};

const expenseCreatedEvent = {
    ...baseEvent,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    subjectType: 'expense',
    metadata: {
        type: 'expense',
        entryId: 'expense-id',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'payer-id',
        payerDisplayName: 'Alex',
        shares: [],
    },
} satisfies AppEvent;

const expenseUpdatedEvent = {
    ...expenseCreatedEvent,
    id: 'updated-expense-id',
    action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    parentActivityId: expenseCreatedEvent.id,
} satisfies AppEvent;

const settlementMetadata = {
    type: 'settlement' as const,
    entryId: 'settlement-id',
    groupId: null,
    groupName: null,
    amount: 30,
    currency: 'USD',
    actorUserId: 'actor-id',
    payerId: 'payer-id',
    fromDisplayName: 'Ilya Govor',
    toDisplayName: 'Huek',
    fieldDiffs: [],
};

test('makes supported events navigable by default', () => {
    render(
        <MemoryRouter>
            <ActivityEvent event={expenseCreatedEvent} />
        </MemoryRouter>,
    );

    expect(screen.getByRole('link').getAttribute('href')).toBe('/activity/activity-id');
});

test('renders supported events without a link when navigation is disabled', () => {
    render(
        <MemoryRouter>
            <ActivityEvent event={expenseCreatedEvent} isNavigable={false} />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('expense-event')).toBeTruthy();
});

test('renders an updated expense and links it to its parent activity', () => {
    render(
        <MemoryRouter>
            <ActivityEvent event={expenseUpdatedEvent} />
        </MemoryRouter>,
    );

    expect(screen.getByRole('link').getAttribute('href')).toBe(
        `/activity/${expenseCreatedEvent.id}`,
    );
    expect(screen.getByTestId('expense-event')).toBeTruthy();
});

test.each([
    {
        action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
        isNavigable: true,
    },
    {
        action: ACTIVITY_ACTIONS.SETTLEMENT_REVERSED,
        isNavigable: false,
    },
])('renders $action with expected navigation', ({ action, isNavigable }) => {
    const event = {
        ...baseEvent,
        domain: 'LEDGER',
        action,
        subjectType: 'settlement',
        metadata: settlementMetadata,
    } satisfies AppEvent;

    render(
        <MemoryRouter>
            <ActivityEvent event={event} />
        </MemoryRouter>,
    );

    expect(Boolean(screen.queryByRole('link'))).toBe(isNavigable);
    expect(screen.getByTestId('settlement-event')).toBeTruthy();
});

test.each([
    {
        action: ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM,
        expectedTitle: 'event.expenseTransferredFromTitle',
    },
    {
        action: ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_TO,
        expectedTitle: 'event.expenseTransferredToTitle',
    },
])('renders $action activity', ({ action, expectedTitle }) => {
    const event = {
        ...baseEvent,
        domain: 'LEDGER',
        action,
        subjectType: 'group_debt_transfer',
        metadata: transferMetadata,
    } satisfies AppEvent;

    render(<ActivityEvent event={event} />);

    expect(screen.getByText(expectedTitle)).toBeTruthy();
    expect(screen.getByText('event.expenseTransferKickDescription')).toBeTruthy();
    expect(screen.getByText('event.expenseTransferCount')).toBeTruthy();
});

test('explains that balances moved because a member left the group', () => {
    const event = {
        ...baseEvent,
        domain: 'LEDGER',
        action: ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM,
        subjectType: 'group_debt_transfer',
        metadata: {
            ...transferMetadata,
            reason: 'LEAVE',
        },
    } satisfies AppEvent;

    render(<ActivityEvent event={event} />);

    expect(
        screen.getByText('event.expenseTransferLeaveDescription'),
    ).toBeTruthy();
});

test('renders member kicked activity', () => {
    const event = {
        ...baseEvent,
        domain: 'GROUP',
        action: ACTIVITY_ACTIONS.MEMBER_KICKED,
        subjectType: 'group',
        groupId: 'group-id',
        metadata: {
            type: 'group',
            groupId: 'group-id',
            groupName: 'Trip',
            targetUserDisplayName: 'Denis',
        },
    } satisfies AppEvent;

    render(<ActivityEvent event={event} />);

    expect(screen.getByText('event.memberKickedDescription')).toBeTruthy();
});
