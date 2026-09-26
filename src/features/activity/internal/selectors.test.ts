import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { getActivityDateKey } from 'helpers/time';

import { getDailyExpenseSummary } from './selectors';

const CURRENT_USER_ID = 'current-user';
const CREATED_AT = 1_785_328_628;

const createExpenseEvent = ({
    id,
    amount,
    payerId,
    shareAmount,
    action = ACTIVITY_ACTIONS.EXPENSE_CREATED,
}: {
    id: string;
    amount: number;
    payerId: string;
    shareAmount: number;
    action?: typeof ACTIVITY_ACTIONS.EXPENSE_CREATED | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
}): AppEvent => ({
    id,
    seq: 1,
    domain: 'LEDGER',
    action,
    actorUserId: payerId,
    actorSnapshot: {
        displayName: 'Misha',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: id,
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: id,
        groupId: null,
        groupName: null,
        description: null,
        amount,
        currency: 'USD',
        payerId,
        payerDisplayName: 'Misha',
        shares: [
            {
                userId: CURRENT_USER_ID,
                displayName: 'Misha',
                shareAmount,
                currency: 'USD',
            },
        ],
    },
    createdAt: CREATED_AT,
    parentActivityId: null,
});

test('aggregates payer and debtor balance changes by day and currency', () => {
    const events = [
        createExpenseEvent({
            id: 'paid-expense',
            amount: 30,
            payerId: CURRENT_USER_ID,
            shareAmount: 10,
        }),
        createExpenseEvent({
            id: 'owed-expense',
            amount: 15,
            payerId: 'other-user',
            shareAmount: 5,
        }),
    ];

    expect(getDailyExpenseSummary(events, CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [
            {
                currency: 'USD',
                netBalance: 15,
            },
        ],
    });
});

test('removes a currency balance when daily changes cancel out', () => {
    const events = [
        createExpenseEvent({
            id: 'paid-expense',
            amount: 30,
            payerId: CURRENT_USER_ID,
            shareAmount: 10,
        }),
        createExpenseEvent({
            id: 'owed-expense',
            amount: 20,
            payerId: 'other-user',
            shareAmount: 20,
        }),
    ];

    expect(getDailyExpenseSummary(events, CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [],
    });
});

test('ignores reversed expenses and returns no summaries without a user', () => {
    const events = [
        createExpenseEvent({
            id: 'reversed-expense',
            amount: 30,
            payerId: CURRENT_USER_ID,
            shareAmount: 10,
            action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
        }),
    ];

    expect(getDailyExpenseSummary(events, CURRENT_USER_ID)).toEqual({});
    expect(getDailyExpenseSummary(events)).toEqual({});
});
