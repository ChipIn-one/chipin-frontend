import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import { EventExpense } from './EventExpense';

vi.mock('basics', importOriginal =>
    importOriginal<typeof import('basics')>().then(basics => ({
        ...basics,
        Amount: ({ className }: { className?: string }) => (
            <span data-testid="expense-amount" className={className} />
        ),
        OwedStatusText: ({ className }: { className?: string }) => (
            <span data-testid="owed-status" className={className} />
        ),
        RelativeTime: () => <time />,
    })),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('store/usersStore', () => ({
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
        'groupId' | 'groupName' | 'groupEmoji'
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
    groupId: group.groupId,
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
                shareAmount: 10,
                currency: 'USD',
            },
        ],
        fieldDiffs: [],
        ...group,
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
});

test('shows the group emoji and name for a group expense', () => {
    render(
        <EventExpense
            event={createExpenseEvent({
                groupId: 'group-1',
                groupName: 'Vietnam',
                groupEmoji: '🌴',
            })}
        />,
    );

    expect(screen.getByText('event.expenseCreatedDescription')).toBeTruthy();
    expect(screen.getByText('🌴')).toBeTruthy();
    expect(screen.getByText('Vietnam')).toBeTruthy();
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

test('renders payer context without an expense description', () => {
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

    expect(screen.getByText('event.expenseCreatedDescription')).toBeTruthy();
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
        getComputedStyle(screen.getByText('event.expenseCreatedDescription'))
            .textDecoration,
    ).toBe('line-through');
    expect(screen.getByText('event.expenseReversedDescription')).toBeTruthy();
    expect(getComputedStyle(screen.getByText('Dinner')).textDecoration).toBe(
        'line-through',
    );
    expect(
        getComputedStyle(screen.getByTestId('expense-amount')).textDecoration,
    ).toBe(
        'line-through',
    );
    expect(
        getComputedStyle(screen.getByTestId('owed-status')).textDecoration,
    ).toBe(
        'line-through',
    );
});
