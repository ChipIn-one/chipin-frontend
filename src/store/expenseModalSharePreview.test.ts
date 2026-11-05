// Snapshot tests of the expense share preview (spec 03, PR 03-2). Every `shares` row is what the
// backend stores as `participantShares` for the same request: `distributeAmount`
// (chipin-backend `features/ledger/shares/ShareDistribution.kt`) over AUTO weights '1', SHARES
// weights or PERCENTAGE percentages in `participantIds` order, or the EXACT amounts as given.
// Inputs go only through public store actions (`initialize` + `set*`, or `initializeEdit` from an
// activity snapshot for values the form cannot type, such as decimal percentages).
// FROZEN through 03-13/03-14 (spec 03 §6, row 6): the `shares` and `feedback` expectations. Only
// the imports, the setup helper and the display block may change there.
import { beforeEach, expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { SharingMode } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';
import { type Money, toUnits } from 'shared/money';

import { mapActivityExpenseToModalState } from './expenseModalEditMapping';
import {
    selectExpensePayload,
    selectExpenseSubmitFeedback,
    selectSharePreview,
    selectSplitSummary,
    selectUserAmount,
} from './expenseModalSelectors';
import {
    type ExpenseModalSource,
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

const A = { id: 'user-a', displayName: 'A', picture: null } satisfies ExpenseParticipant;
const B = { id: 'user-b', displayName: 'B', picture: null } satisfies ExpenseParticipant;
const C = { id: 'user-c', displayName: 'C', picture: null } satisfies ExpenseParticipant;
const member = (id: string): ExpenseParticipant => ({ id, displayName: id, picture: null });

interface PreviewCase {
    name: string;
    /** Direct expense between the first member (the current user) and the second. */
    target?: 'friends';
    /** The current user first; default A, B, C. */
    members?: ExpenseParticipant[];
    currency?: string;
    amount: string;
    mode: ExpenseSplitMode;
    /** Per member, in `members` order. */
    values?: string[];
    excluded?: string[];
    payer?: string;
    /** Loaded through `initializeEdit` from an activity snapshot (group, payer A, no exclusions). */
    edit?: true;
    /** Exact shares of the included members in request order, scale 4. */
    shares: string[];
    /** `selectUserAmount` per member, in `members` order. */
    display: number[];
    summary: {
        assigned: number;
        total: number;
        yourShare: number;
        status: string;
        progress: number;
    };
    feedback: Record<string, unknown> | null;
}

const E = EXPENSE_SPLIT_MODES;

const CASES: PreviewCase[] = [
    {
        name: 'equal 100.00 / 3 USD',
        amount: '100.00',
        mode: E.EQUAL,
        shares: ['33.3334', '33.3333', '33.3333'],
        display: [33.33, 33.33, 33.33],
        summary: { assigned: 100, total: 100, yourShare: 33.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 0.01 / 3 USD',
        amount: '0.01',
        mode: E.EQUAL,
        shares: ['0.0034', '0.0033', '0.0033'],
        display: [0.0034, 0.0033, 0.0033],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0.0034, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 0.02 / 3 USD',
        amount: '0.02',
        mode: E.EQUAL,
        shares: ['0.0067', '0.0067', '0.0066'],
        display: [0.01, 0.01, 0.01],
        summary: { assigned: 0.02, total: 0.02, yourShare: 0.01, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 100 / 7 USD',
        members: [A, B, C, member('u4'), member('u5'), member('u6'), member('u7')],
        amount: '100',
        mode: E.EQUAL,
        shares: ['14.2858', '14.2857', '14.2857', '14.2857', '14.2857', '14.2857', '14.2857'],
        display: [14.29, 14.29, 14.29, 14.29, 14.29, 14.29, 14.29],
        summary: { assigned: 100, total: 100, yourShare: 14.29, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 0.01 / 2 USD',
        members: [A, B],
        amount: '0.01',
        mode: E.EQUAL,
        shares: ['0.0050', '0.0050'],
        display: [0.01, 0.01],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0.01, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 3.015 single participant',
        amount: '3.015',
        mode: E.EQUAL,
        excluded: ['user-b', 'user-c'],
        shares: ['3.0150'],
        display: [3.02, 0, 0],
        summary: { assigned: 3.02, total: 3.02, yourShare: 3.02, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 1000 / 3 JPY',
        currency: 'JPY',
        amount: '1000',
        mode: E.EQUAL,
        shares: ['333.3334', '333.3333', '333.3333'],
        display: [333, 333, 333],
        summary: { assigned: 1000, total: 1000, yourShare: 333, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 10 / 3 KWD',
        currency: 'KWD',
        amount: '10',
        mode: E.EQUAL,
        shares: ['3.3334', '3.3333', '3.3333'],
        display: [3.333, 3.333, 3.333],
        summary: { assigned: 10, total: 10, yourShare: 3.333, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 10.001 / 3 KWD',
        currency: 'KWD',
        amount: '10.001',
        mode: E.EQUAL,
        shares: ['3.3337', '3.3337', '3.3336'],
        display: [3.334, 3.334, 3.334],
        summary: {
            assigned: 10.001,
            total: 10.001,
            yourShare: 3.334,
            status: 'exact',
            progress: 100,
        },
        feedback: null,
    },
    {
        name: 'equal 999999999999.99 / 3 USD',
        amount: '999999999999.99',
        mode: E.EQUAL,
        shares: ['333333333333.3300', '333333333333.3300', '333333333333.3300'],
        display: [333333333333.33, 333333333333.33, 333333333333.33],
        summary: {
            assigned: 999999999999.99,
            total: 999999999999.99,
            yourShare: 333333333333.33,
            status: 'exact',
            progress: 100,
        },
        feedback: null,
    },
    {
        name: 'equal 12345678901234.56 / 3 USD',
        amount: '12345678901234.56',
        mode: E.EQUAL,
        shares: ['4115226300411.5200', '4115226300411.5200', '4115226300411.5200'],
        display: [4115226300411.52, 4115226300411.52, 4115226300411.52],
        summary: {
            assigned: 12345678901234.56,
            total: 12345678901234.56,
            yourShare: 4115226300411.52,
            status: 'exact',
            progress: 100,
        },
        feedback: null,
    },
    {
        name: 'equal 1.0049 / 3 USD (api precision)',
        amount: '1.0049',
        mode: E.EQUAL,
        shares: ['0.3350', '0.3350', '0.3349'],
        display: [0.34, 0.34, 0.33],
        summary: { assigned: 1, total: 1, yourShare: 0.34, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'equal 0.0149 / 3 USD (api precision)',
        amount: '0.0149',
        mode: E.EQUAL,
        shares: ['0.0050', '0.0050', '0.0049'],
        display: [0.01, 0.01, 0.0049],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0.01, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 33.335/33.335/33.33 of 1',
        edit: true,
        amount: '1',
        mode: E.PERCENT,
        values: ['33.335', '33.335', '33.33'],
        shares: ['0.3334', '0.3333', '0.3333'],
        display: [0.33, 0.33, 0.33],
        summary: { assigned: 1, total: 1, yourShare: 0.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 0.07/0.07/99.86 of 0.01',
        edit: true,
        amount: '0.01',
        mode: E.PERCENT,
        values: ['0.07', '0.07', '99.86'],
        shares: ['0.0000', '0.0000', '0.0100'],
        display: [0, 0, 0.01],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 37.55/26.65/35.8 of 100 (float sum 99.999…)',
        edit: true,
        amount: '100',
        mode: E.PERCENT,
        values: ['37.55', '26.65', '35.8'],
        shares: ['37.5500', '26.6500', '35.8000'],
        display: [37.55, 26.65, 35.8],
        summary: { assigned: 100, total: 100, yourShare: 37.55, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'shares 1/1/2 of 100',
        amount: '100',
        mode: E.SHARES,
        values: ['1', '1', '2'],
        shares: ['25.0000', '25.0000', '50.0000'],
        display: [25, 25, 50],
        summary: { assigned: 100, total: 100, yourShare: 25, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'shares 1/2/0 of 10',
        amount: '10',
        mode: E.SHARES,
        values: ['1', '2', '0'],
        shares: ['3.3333', '6.6667', '0.0000'],
        display: [3.33, 6.67, 0],
        summary: { assigned: 10, total: 10, yourShare: 3.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'shares 3/7/11 of 1',
        amount: '1',
        mode: E.SHARES,
        values: ['3', '7', '11'],
        shares: ['0.1429', '0.3333', '0.5238'],
        display: [0.14, 0.33, 0.52],
        summary: { assigned: 1, total: 1, yourShare: 0.14, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'shares 0/0/0 of 10',
        amount: '10',
        mode: E.SHARES,
        values: ['0', '0', '0'],
        shares: ['0.0000', '0.0000', '0.0000'],
        display: [0, 0, 0],
        summary: { assigned: 0, total: 10, yourShare: 0, status: 'under', progress: 0 },
        feedback: { reason: 'shares', current: 0 },
    },
    {
        name: 'percent 34/33/33 of 10',
        amount: '10',
        mode: E.PERCENT,
        values: ['34', '33', '33'],
        shares: ['3.4000', '3.3000', '3.3000'],
        display: [3.4, 3.3, 3.3],
        summary: { assigned: 10, total: 10, yourShare: 3.4, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 33.33/33.33/33.34 of 100',
        edit: true,
        amount: '100',
        mode: E.PERCENT,
        values: ['33.33', '33.33', '33.34'],
        shares: ['33.3300', '33.3300', '33.3400'],
        display: [33.33, 33.33, 33.34],
        summary: { assigned: 100, total: 100, yourShare: 33.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 50/50/0 of 2.01',
        amount: '2.01',
        mode: E.PERCENT,
        values: ['50', '50', '0'],
        shares: ['1.0050', '1.0050', '0.0000'],
        display: [1.01, 1.01, 0],
        summary: { assigned: 2.01, total: 2.01, yourShare: 1.01, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 33/33/34 of 0.01',
        amount: '0.01',
        mode: E.PERCENT,
        values: ['33', '33', '34'],
        shares: ['0.0033', '0.0033', '0.0034'],
        display: [0.0033, 0.0033, 0.0034],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0.0033, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 10.1/20.2/69.7 of 1',
        edit: true,
        amount: '1',
        mode: E.PERCENT,
        values: ['10.1', '20.2', '69.7'],
        shares: ['0.1010', '0.2020', '0.6970'],
        display: [0.1, 0.2, 0.7],
        summary: { assigned: 1, total: 1, yourShare: 0.1, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'percent 50/40/0 (under) of 100',
        amount: '100',
        mode: E.PERCENT,
        values: ['50', '40', '0'],
        shares: ['50.0000', '40.0000', '0.0000'],
        display: [50, 40, 0],
        summary: { assigned: 90, total: 100, yourShare: 50, status: 'under', progress: 90 },
        feedback: { reason: 'percentUnder', current: 90, required: 100, difference: 10 },
    },
    {
        name: 'percent 1000 JPY 33/33/34',
        currency: 'JPY',
        amount: '1000',
        mode: E.PERCENT,
        values: ['33', '33', '34'],
        shares: ['330.0000', '330.0000', '340.0000'],
        display: [330, 330, 340],
        summary: { assigned: 1000, total: 1000, yourShare: 330, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'exact 20/30/50 of 100',
        amount: '100',
        mode: E.AMOUNTS,
        values: ['20', '30', '50'],
        shares: ['20.0000', '30.0000', '50.0000'],
        display: [20, 30, 50],
        summary: { assigned: 100, total: 100, yourShare: 20, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'exact 33.33/33.33/33.34 of 100',
        amount: '100',
        mode: E.AMOUNTS,
        values: ['33.33', '33.33', '33.34'],
        shares: ['33.3300', '33.3300', '33.3400'],
        display: [33.33, 33.33, 33.34],
        summary: { assigned: 100, total: 100, yourShare: 33.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'exact KWD 1.235/0.765/0 of 2',
        currency: 'KWD',
        amount: '2',
        mode: E.AMOUNTS,
        values: ['1.235', '0.765', '0'],
        shares: ['1.2350', '0.7650', '0.0000'],
        display: [1.235, 0.765, 0],
        summary: { assigned: 2, total: 2, yourShare: 1.235, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'exact 0.9991/0/0 of 1 (api precision)',
        edit: true,
        amount: '1',
        mode: E.AMOUNTS,
        values: ['0.9991', '0', '0'],
        shares: ['0.9991', '0.0000', '0.0000'],
        display: [1, 0, 0],
        summary: { assigned: 1, total: 1, yourShare: 1, status: 'under', progress: 99.91 },
        feedback: { reason: 'amountsUnder', current: 0.9991, required: 1, difference: 0.0009 },
    },
    {
        name: 'exact 20/30/40 under of 100',
        amount: '100',
        mode: E.AMOUNTS,
        values: ['20', '30', '40'],
        shares: ['20.0000', '30.0000', '40.0000'],
        display: [20, 30, 40],
        summary: { assigned: 90, total: 100, yourShare: 20, status: 'under', progress: 90 },
        feedback: { reason: 'amountsUnder', current: 90, required: 100, difference: 10 },
    },
    {
        name: 'payer not participant equal 10 / 2',
        amount: '10',
        mode: E.EQUAL,
        excluded: ['user-b'],
        payer: 'user-b',
        shares: ['5.0000', '5.0000'],
        display: [5, 0, 5],
        summary: { assigned: 10, total: 10, yourShare: 5, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'current user excluded shares 1/1',
        amount: '10',
        mode: E.SHARES,
        values: ['1', '1', '1'],
        excluded: ['user-a'],
        shares: ['5.0000', '5.0000'],
        display: [0, 5, 5],
        summary: { assigned: 10, total: 10, yourShare: 0, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'friends 0.01 / 2 payer A',
        target: 'friends',
        members: [A, B],
        amount: '0.01',
        mode: E.EQUAL,
        payer: 'user-a',
        shares: ['0.0050', '0.0050'],
        display: [0.01, 0.01],
        summary: { assigned: 0.01, total: 0.01, yourShare: 0.01, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'friends 0.0001 / 2 payer A',
        target: 'friends',
        members: [A, B],
        amount: '0.0001',
        mode: E.EQUAL,
        payer: 'user-a',
        shares: ['0.0001', '0.0000'],
        display: [0.0001, 0],
        summary: {
            assigned: 0.0001,
            total: 0.0001,
            yourShare: 0.0001,
            status: 'exact',
            progress: 100,
        },
        feedback: { reason: 'noDebt' },
    },
    {
        name: 'friends 0.0001 / 2 payer B',
        target: 'friends',
        members: [A, B],
        amount: '0.0001',
        mode: E.EQUAL,
        payer: 'user-b',
        shares: ['0.0001', '0.0000'],
        display: [0.0001, 0],
        summary: {
            assigned: 0.0001,
            total: 0.0001,
            yourShare: 0.0001,
            status: 'exact',
            progress: 100,
        },
        feedback: null,
    },
    {
        name: 'friends 10 shares 1/2 payer B',
        target: 'friends',
        members: [A, B],
        amount: '10',
        mode: E.SHARES,
        values: ['1', '2'],
        payer: 'user-b',
        shares: ['3.3333', '6.6667'],
        display: [3.33, 6.67],
        summary: { assigned: 10, total: 10, yourShare: 3.33, status: 'exact', progress: 100 },
        feedback: null,
    },
    {
        name: 'friends exact 10/0 payer A',
        target: 'friends',
        members: [A, B],
        amount: '10',
        mode: E.AMOUNTS,
        values: ['10', '0'],
        payer: 'user-a',
        shares: ['10.0000', '0.0000'],
        display: [10, 0],
        summary: { assigned: 10, total: 10, yourShare: 10, status: 'exact', progress: 100 },
        feedback: { reason: 'noDebt' },
    },
    {
        name: 'friends percent 100/0 payer B',
        target: 'friends',
        members: [A, B],
        amount: '10',
        mode: E.PERCENT,
        values: ['100', '0'],
        payer: 'user-b',
        shares: ['10.0000', '0.0000'],
        display: [10, 0],
        summary: { assigned: 10, total: 10, yourShare: 10, status: 'exact', progress: 100 },
        feedback: null,
    },
];

type ExpenseActivityEvent = Extract<AppEvent, { subjectType: 'expense' }>;

const toSharingMode = (item: PreviewCase, members: ExpenseParticipant[]): SharingMode => {
    const values = Object.fromEntries(
        members.map((user, index) => [user.id, Number(item.values?.[index] ?? '0')]),
    );

    switch (item.mode) {
        case E.PERCENT:
            return { type: 'PERCENTAGE', percentageShares: values };
        case E.AMOUNTS:
            return { type: 'EXACT', customShares: values };
        case E.SHARES:
            return { type: 'SHARES', shares: values };
        case E.EQUAL:
            return { type: 'AUTO' };
    }
};

/** An activity snapshot of the expense, as the edit flow receives it. */
const toExpenseEvent = (
    item: PreviewCase,
    members: ExpenseParticipant[],
): ExpenseActivityEvent => ({
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: A.id,
    actorSnapshot: { displayName: A.displayName, picture: null },
    subjectType: 'expense',
    subjectId: 'entry-1',
    groupId: 'group-1',
    metadata: {
        type: 'expense',
        entryId: 'entry-1',
        groupId: 'group-1',
        groupName: 'Group',
        description: 'Dinner',
        amount: Number(item.amount),
        currency: item.currency ?? 'USD',
        category: 'food',
        payerId: A.id,
        payerDisplayName: A.displayName,
        sharingMode: toSharingMode(item, members),
        shares: members.map(user => ({
            userId: user.id,
            displayName: user.displayName,
            shareAmount: 0,
            currency: item.currency ?? 'USD',
        })),
    },
    createdAt: 1_700_000_000,
    parentActivityId: null,
});

const setUp = (item: PreviewCase): ExpenseParticipant[] => {
    const members = item.members ?? [A, B, C];
    const [self, ...others] = members;
    const store = useExpenseModalStore.getState();
    const base = {
        currentUser: self ?? null,
        defaultCurrency: item.currency ?? 'USD',
        defaultCategory: 'food',
        skipCategory: false,
    };
    const groupSource: ExpenseModalSource = {
        ...base,
        context: 'group',
        groups: [{ id: 'group-1', members }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    };

    if (item.edit) {
        const initialization = mapActivityExpenseToModalState({
            parentEvent: toExpenseEvent(item, members),
            childEvents: [],
            source: groupSource,
        });

        if (!initialization) {
            throw new Error(`No edit initialization for ${item.name}`);
        }
        store.initializeEdit(initialization);
        // A change, so the edit is submittable and the feedback is about the split only.
        useExpenseModalStore.getState().setDescription('Dinner (edited)');

        return members;
    }

    if (item.target === 'friends') {
        store.initialize({
            ...base,
            context: 'friends',
            groups: [],
            knownFriends: others,
            preferredFriendId: others[0]?.id,
        });
    } else {
        store.initialize(groupSource);
    }

    const actions = useExpenseModalStore.getState();

    actions.setDescription('Dinner');
    actions.setAmount(item.amount);
    for (const userId of item.excluded ?? []) {
        actions.setParticipantIncluded(userId, false);
    }
    actions.setSplitMode(item.mode);
    if (item.mode !== E.EQUAL) {
        members.forEach((user, index) => {
            useExpenseModalStore.getState().setSplitValue(user.id, item.values?.[index] ?? '0');
        });
    }
    if (item.payer) {
        useExpenseModalStore.getState().setPaidById(item.payer);
    }

    return members;
};

const toDecimal = (money: Money): string => {
    const units = toUnits(money);

    return `${units / 10_000n}.${(units % 10_000n).toString().padStart(4, '0')}`;
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

// FROZEN: unchanged through 03-13/03-14.
test.each(CASES)('share preview: $name', item => {
    setUp(item);
    const state = useExpenseModalStore.getState();

    expect(selectSharePreview(state).shares.map(({ share }) => toDecimal(share))).toEqual(
        item.shares,
    );
    expect(selectExpenseSubmitFeedback(state)).toEqual(item.feedback);
});

// DISPLAY: the numbers the legacy `Amount` renders. Adaptable when `Amount` moves to
// `formatMoneyParts` (spec 03 §4.4); the frozen block above does not depend on them.
test.each(CASES)('share preview display: $name', item => {
    const members = setUp(item);
    const state = useExpenseModalStore.getState();
    const summary = selectSplitSummary(state);

    expect(members.map(user => selectUserAmount(state, user.id))).toEqual(item.display);
    expect({
        assigned: summary.assignedAmount,
        total: summary.totalAmount,
        yourShare: summary.yourShareAmount,
        status: summary.status,
        progress: summary.progressPercent,
    }).toEqual(item.summary);
});

test('a valid preview distributes exactly the total', () => {
    for (const item of CASES) {
        setUp(item);
        const preview = selectSharePreview(useExpenseModalStore.getState());

        if (preview.isValid && preview.shares.length > 0) {
            const sum = preview.shares.reduce((total, { share }) => total + toUnits(share), 0n);

            expect(sum, item.name).toBe(toUnits(preview.total));
        }
        useExpenseModalStore.getState().reset();
    }
});

test('the preview follows the payload participant order', () => {
    for (const item of CASES) {
        setUp(item);
        const state = useExpenseModalStore.getState();
        const payload = selectExpensePayload(state);

        if (payload) {
            expect(
                selectSharePreview(state).shares.map(({ userId }) => userId),
                item.name,
            ).toEqual(payload.participantIds);
        }
        useExpenseModalStore.getState().reset();
    }
});
