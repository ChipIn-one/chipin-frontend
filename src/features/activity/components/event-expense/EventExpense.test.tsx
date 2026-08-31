import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import { EventExpense } from './EventExpense';

vi.mock('basics', importOriginal =>
    importOriginal<typeof import('basics')>().then(basics => ({
        ...basics,
        Amount: ({
            className,
            tokenCode,
            type,
            value,
        }: {
            className?: string;
            tokenCode?: string;
            type?: string;
            value: number;
        }) => (
            <span
                data-testid="expense-amount"
                data-type={type}
                className={className}
            >
                {value} {tokenCode}
            </span>
        ),
        RelativeTime: () => <time data-testid="relative-time" />,
    })),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { payer?: string }) => {
            if (key === 'event.paidAmount') {
                return `${options?.payer} paid`;
            }

            if (key === 'event.you') {
                return 'You';
            }

            if (key === 'event.youLent') {
                return 'You lent';
            }

            if (key === 'event.youBorrowed') {
                return 'You borrowed';
            }

            return key;
        },
    }),
}));

vi.mock('store/users-store', () => ({
    useUsersStore: (selector: (state: { user: { id: string } }) => unknown) =>
        selector({ user: { id: 'current-user' } }),
}));

vi.mock('store/groupsStore', () => ({
    useGroupsStore: (selector: (state: { groups: []; selectedGroup: null }) => unknown) =>
        selector({ groups: [], selectedGroup: null }),
}));

const createExpenseEvent = (
    group: Pick<
        Extract<AppEvent, { action: 'EXPENSE_CREATED' }>['metadata'],
        'groupId' | 'groupName'
    >,
    description: string | null = 'Dinner',
    action:
        | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
        | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED = ACTIVITY_ACTIONS.EXPENSE_CREATED,
): Extract<
    AppEvent,
    {
        action:
            | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
            | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    }
> => ({
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action,
    actorUserId: 'payer-1',
    actorSnapshot: {
        displayName: 'Misha',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: 'expense-1',
    groupId: group.groupId ?? null,
    metadata: {
        type: 'expense',
        entryId: 'expense-1',
        description,
        amount: 30,
        currency: 'USD',
        payerId: 'payer-1',
        payerDisplayName: 'Misha',
        shares: [
            {
                userId: 'current-user',
                displayName: 'Current user',
                shareAmount: 10,
                currency: 'USD',
            },
        ],
        ...group,
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
});

test('shows the group name for a group expense', () => {
    render(
        <EventExpense
            event={createExpenseEvent({
                groupId: 'group-1',
                groupName: 'Vietnam',
            })}
        />,
    );

    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.queryByText('event.expenseCreatedDescription')).toBeNull();
    expect(screen.getByText('Misha paid')).toBeTruthy();
    expect(screen.getByText('30 USD')).toBeTruthy();
    expect(screen.getByText('You borrowed')).toBeTruthy();
    expect(screen.getByText('10 USD')).toBeTruthy();
    expect(screen.getByText('Vietnam')).toBeTruthy();
    expect(screen.queryByTestId('relative-time')).toBeNull();
    for (const amount of screen.getAllByTestId('expense-amount')) {
        expect(amount.dataset.type).toBe('summary');
    }
});

test('uses You when the current user paid the expense', () => {
    const event = createExpenseEvent({
        groupId: 'group-1',
        groupName: 'Vietnam',
    });
    event.metadata.payerId = 'current-user';

    render(<EventExpense event={event} />);

    expect(screen.getByText('You paid')).toBeTruthy();
    expect(screen.getByText('You lent')).toBeTruthy();
    expect(screen.getByText('20 USD')).toBeTruthy();
    expect(screen.getAllByText('30 USD')).toHaveLength(1);
});

test('shows between friends for a direct expense', () => {
    render(
        <EventExpense
            event={createExpenseEvent({
                groupId: null,
                groupName: null,
            })}
        />,
    );

    expect(screen.getByText('event.betweenFriends')).toBeTruthy();
});

test('renders only the payment summary without an expense description', () => {
    render(
        <EventExpense
            event={createExpenseEvent(
                {
                    groupId: 'group-1',
                    groupName: 'Vietnam',
                },
                null,
            )}
        />,
    );

    expect(screen.getByText('Misha paid')).toBeTruthy();
    expect(screen.queryByText('event.expenseCreatedDescription')).toBeNull();
    expect(screen.queryByText('Dinner')).toBeNull();
});

test('shows reversed expense context and strikes through monetary values', () => {
    render(
        <EventExpense
            event={createExpenseEvent(
                {
                    groupId: null,
                    groupName: null,
                },
                'Dinner',
                ACTIVITY_ACTIONS.EXPENSE_REVERSED,
            )}
        />,
    );

    expect(
        getComputedStyle(screen.getByText('Dinner')).textDecoration,
    ).toBe('line-through');
    expect(screen.getByText('event.expenseReversedDescription')).toBeTruthy();
    expect(
        getComputedStyle(screen.getByText('30 USD')).textDecoration,
    ).toBe(
        'line-through',
    );
    expect(
        getComputedStyle(screen.getByText('You borrowed')).textDecoration,
    ).toBe('line-through');
    expect(getComputedStyle(screen.getByText('10 USD')).textDecoration).toBe(
        'line-through',
    );
});
