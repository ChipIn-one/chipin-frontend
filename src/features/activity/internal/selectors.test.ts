import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import { getActivityPreviewEvents } from 'helpers/activityEvent';
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
    currency = 'USD',
    groupId = null,
    createdAt = CREATED_AT,
}: {
    id: string;
    amount: number;
    payerId: string;
    shareAmount: number;
    action?: typeof ACTIVITY_ACTIONS.EXPENSE_CREATED | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    currency?: string;
    groupId?: string | null;
    createdAt?: number;
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
    groupId,
    metadata: {
        type: 'expense',
        entryId: id,
        groupId,
        groupName: groupId ? 'Shared group' : null,
        description: null,
        amount,
        currency,
        payerId,
        payerDisplayName: 'Misha',
        shares: [
            {
                userId: CURRENT_USER_ID,
                displayName: 'Misha',
                shareAmount,
                currency,
            },
        ],
    },
    createdAt,
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

const createPreview = (parent: AppEvent, lastEvent: AppEvent = parent): ActivityFeedItem => ({
    parent,
    lastEvent,
});

test('ACT-021 includes edited 6000 USD debt and unedited 1000 USD debt, excluding self-only shares', () => {
    const original = createExpenseEvent({
        id: 'edited-parent', amount: 6000, payerId: 'friend', shareAmount: 6000,
    });
    const edited = createExpenseEvent({
        id: 'edited-latest', amount: 6000, payerId: 'friend', shareAmount: 6000,
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
        createdAt: CREATED_AT + 86400,
    });
    const unchanged = createExpenseEvent({
        id: 'unchanged', amount: 1000, payerId: 'friend', shareAmount: 1000,
    });
    const selfOnly = createExpenseEvent({
        id: 'self-only', amount: 6000, payerId: CURRENT_USER_ID, shareAmount: 6000,
    });

    expect(getDailyExpenseSummary([
        createPreview(original, edited),
        createPreview(unchanged),
        createPreview(selfOnly),
    ], CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [{ currency: 'USD', netBalance: -7000 }],
    });
});

test('ACT-021 uses original activity date rather than later edit or expense business date', () => {
    const parent = createExpenseEvent({
        id: 'parent', amount: 50, payerId: 'friend', shareAmount: 50,
    });
    const editDate = CREATED_AT + 3 * 86400;
    const updated = createExpenseEvent({
        id: 'later-edit', amount: 75, payerId: 'friend', shareAmount: 75,
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED, createdAt: editDate,
    });
    const withBusinessDate = {
        ...updated,
        metadata: {
            type: 'expense',
            entryId: 'later-edit',
            amount: 75,
            currency: 'USD',
            payerId: 'friend',
            payerDisplayName: 'Friend',
            date: editDate + 86400,
            shares: [
                { userId: CURRENT_USER_ID, displayName: 'Me', shareAmount: 75, currency: 'USD' },
            ],
        },
    } satisfies AppEvent;

    expect(getDailyExpenseSummary([createPreview(parent, withBusinessDate)], CURRENT_USER_ID))
        .toEqual({
            [getActivityDateKey(CREATED_AT)]: [{ currency: 'USD', netBalance: -75 }],
        });
});

test('ACT-021 includes changed group expense once, including duplicated pagination parents', () => {
    const parent = createExpenseEvent({
        id: 'group-parent', amount: 100, payerId: 'group-payer',
        shareAmount: 40, groupId: 'group-one',
    });
    const current = createExpenseEvent({
        id: 'group-edit', amount: 200, payerId: 'group-payer',
        shareAmount: 80, groupId: 'group-one', action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    });
    const item = createPreview(parent, current);
    const another = createPreview(createExpenseEvent({
        id: 'second-group', amount: 30, payerId: CURRENT_USER_ID,
        shareAmount: 10, groupId: 'group-one',
    }));

    expect(getDailyExpenseSummary([item, another, item], CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [{ currency: 'USD', netBalance: -60 }],
    });
});

test('nets opposite signs per date and currency without mixing currencies', () => {
    const expenses = [
        createExpenseEvent({
            id: 'owe-usd', amount: 300, payerId: 'friend', shareAmount: 300,
        }),
        createExpenseEvent({
            id: 'lent-usd', amount: 150, payerId: CURRENT_USER_ID, shareAmount: 50,
        }),
        createExpenseEvent({
            id: 'owe-vnd', amount: 100000, payerId: 'friend',
            shareAmount: 100000, currency: 'VND',
        }),
    ].map(event => createPreview(event));

    expect(getDailyExpenseSummary(expenses, CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [
            { currency: 'USD', netBalance: -200 },
            { currency: 'VND', netBalance: -100000 },
        ],
    });
});

test('ACT-022 excludes reversed preview chains and keeps settlements out of expense totals', () => {
    const parent = createExpenseEvent({
        id: 'reversed-parent', amount: 40, payerId: 'friend', shareAmount: 40,
    });
    const reversal = createExpenseEvent({
        id: 'reversed-child', amount: 40, payerId: 'friend', shareAmount: 40,
        action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    });
    const settlementWithNoMetadata = {
        ...parent,
        id: 'settlement',
        action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
        metadata: null,
    } satisfies AppEvent;

    const previews = getActivityPreviewEvents([
        createPreview(parent, reversal),
        createPreview(settlementWithNoMetadata),
    ]);

    expect(getDailyExpenseSummary(previews, CURRENT_USER_ID)).toEqual({});
});

test('ACT-007 handles missing metadata and missing shares without inventing debt', () => {
    const expense = createExpenseEvent({
        id: 'missing', amount: 100, payerId: 'friend', shareAmount: 100,
    });
    const missingMetadata = {
        ...expense,
        metadata: null,
    } satisfies AppEvent;
    const noShares = {
        ...expense,
        id: 'no-shares',
        metadata: {
            type: 'expense',
            entryId: 'no-shares',
            amount: 100,
            currency: 'USD',
            payerId: 'friend',
            payerDisplayName: 'Friend',
            shares: undefined,
        },
    } satisfies AppEvent;

    expect(getDailyExpenseSummary([
        createPreview(expense, missingMetadata),
        createPreview(noShares),
    ], CURRENT_USER_ID)).toEqual({});
});

test('ACT-023 recomputes deterministic daily totals when another preview page arrives', () => {
    const first = createPreview(createExpenseEvent({
        id: 'first-page', amount: 10, payerId: 'friend', shareAmount: 10,
    }));
    const second = createPreview(createExpenseEvent({
        id: 'second-page', amount: 5, payerId: 'friend', shareAmount: 5,
    }));
    const day = getActivityDateKey(CREATED_AT);

    expect(getDailyExpenseSummary([first], CURRENT_USER_ID)).toEqual({
        [day]: [{ currency: 'USD', netBalance: -10 }],
    });
    expect(getDailyExpenseSummary([first, second, second], CURRENT_USER_ID)).toEqual({
        [day]: [{ currency: 'USD', netBalance: -15 }],
    });
});

test('ACT-020 leaves flat history event semantics intact', () => {
    const original = createExpenseEvent({
        id: 'created', amount: 10, payerId: 'friend', shareAmount: 10,
    });
    const edited = createExpenseEvent({
        id: 'updated', amount: 50, payerId: 'friend', shareAmount: 50,
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    });

    expect(getDailyExpenseSummary([original, edited], CURRENT_USER_ID)).toEqual({
        [getActivityDateKey(CREATED_AT)]: [{ currency: 'USD', netBalance: -10 }],
    });
});
