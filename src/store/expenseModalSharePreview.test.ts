// Snapshot tests of the expense share preview (spec 03, PR 03-2). Every `shares` row is what the
// backend stores as `participantShares` for the same request: `distributeAmount`
// (chipin-backend `features/ledger/shares/ShareDistribution.kt`) over AUTO weights '1', SHARES
// weights or PERCENTAGE percentages in `participantIds` order, or the EXACT amounts as given.
// `display` is what the form shows per member (`roundToMinor`, "< 0.01" below one minor unit).
// These assertions must stay unchanged through 03-13/03-14 (spec 03 §6, row 6).
import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';
import { type Money, toUnits } from 'shared/money';

import {
    selectExpensePayload,
    selectExpenseSubmitFeedback,
    selectSharePreview,
    selectSplitSummary,
    selectUserAmount,
} from './expenseModalSelectors';
import { type ExpenseParticipant, useExpenseModalStore } from './expenseModalStore';

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

const setUp = (item: PreviewCase): ExpenseParticipant[] => {
    const members = item.members ?? [A, B, C];
    const [self, ...others] = members;
    const store = useExpenseModalStore.getState();
    const source = {
        currentUser: self ?? null,
        defaultCurrency: item.currency ?? 'USD',
        defaultCategory: 'food',
        skipCategory: false,
    };

    if (item.target === 'friends') {
        store.initialize({
            ...source,
            context: 'friends',
            groups: [],
            knownFriends: others,
            preferredFriendId: others[0]?.id,
        });
    } else {
        store.initialize({
            ...source,
            context: 'group',
            groups: [{ id: 'group-1', members }],
            knownFriends: [],
            defaultGroupId: 'group-1',
        });
    }
    store.setDescription('Dinner');
    store.setAmount(item.amount);
    store.setSplitMode(item.mode);

    const values = Object.fromEntries(
        members.map((user, index) => [user.id, item.values?.[index] ?? '0']),
    );

    useExpenseModalStore.setState(state => ({
        ...state,
        ...(item.mode === E.PERCENT
            ? { percentShares: values, isPercentManuallyEdited: true }
            : {}),
        ...(item.mode === E.AMOUNTS ? { amountShares: values } : {}),
        ...(item.mode === E.SHARES ? { shareWeights: values } : {}),
        includedParticipantIds: Object.fromEntries(
            members.map(user => [user.id, !(item.excluded ?? []).includes(user.id)]),
        ),
        ...(item.payer ? { paidById: item.payer } : {}),
    }));

    return members;
};

const toDecimal = (money: Money): string => {
    const units = toUnits(money);

    return `${units / 10_000n}.${(units % 10_000n).toString().padStart(4, '0')}`;
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test.each(CASES)('share preview: $name', item => {
    const members = setUp(item);
    const state = useExpenseModalStore.getState();
    const preview = selectSharePreview(state);
    const summary = selectSplitSummary(state);

    expect(preview.shares.map(({ share }) => toDecimal(share))).toEqual(item.shares);
    expect(members.map(user => selectUserAmount(state, user.id))).toEqual(item.display);
    expect({
        assigned: summary.assignedAmount,
        total: summary.totalAmount,
        yourShare: summary.yourShareAmount,
        status: summary.status,
        progress: summary.progressPercent,
    }).toEqual(item.summary);
    expect(selectExpenseSubmitFeedback(state)).toEqual(item.feedback);
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
