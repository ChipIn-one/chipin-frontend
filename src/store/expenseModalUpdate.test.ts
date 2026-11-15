import { expect, test } from 'vitest';

import type { ExpenseDraft, ExpenseDraftSharingMode } from 'entities/ledger';
import { currencyCode, fromUnits, type Money } from 'shared/money';

import { buildExpenseUpdateParams, type ExpenseModalOriginalState } from './expenseModalUpdate';

const money = (units: bigint, currency = 'USD'): Money => fromUnits(units, currencyCode(currency));

const original: ExpenseModalOriginalState = {
    description: 'Dinner',
    amount: money(1_200_000n),
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    currency: 'USD',
    category: 'food',
    subcategory: 'restaurants',
    sharingMode: {
        type: 'PERCENTAGE',
        percentageShares: { 'user-1': '25', 'user-2': '75' },
    },
};

const draft: ExpenseDraft = {
    description: 'Dinner',
    amount: money(1_200_000n),
    date: 1_700_000_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    category: 'food',
    sharingMode: original.sharingMode,
};

test('builds a description-only partial update', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, description: 'Lunch' })).toEqual({
        description: 'Lunch',
    });
});

test('represents an intentionally cleared description as null', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, description: '' })).toEqual({
        description: null,
    });
});

test('includes payer and currency without sending a changed date', () => {
    expect(
        buildExpenseUpdateParams(original, {
            ...draft,
            payerId: 'user-2',
            amount: money(1_200_000n, 'EUR'),
            date: 1_700_000_001,
        }),
    ).toEqual({ payerId: 'user-2', currency: 'EUR' });
});

test('does not create an update for a date-only change', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, date: 1_700_000_001 })).toBeNull();
});

test('sends the complete atomic split block when amount changes', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, amount: money(1_500_000n) })).toEqual({
        amount: money(1_500_000n),
        participantIds: ['user-1', 'user-2'],
        sharingMode: original.sharingMode,
    });
});

test('does not treat participant ordering as a split change', () => {
    expect(
        buildExpenseUpdateParams(original, { ...draft, participantIds: ['user-2', 'user-1'] }),
    ).toBeNull();
});

test('does not send category or hidden subcategory when category is unchanged', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, description: 'Updated dinner' })).toEqual(
        { description: 'Updated dinner' },
    );
});

test('sends a changed category without stale subcategory', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, category: 'transport' })).toEqual({
        category: 'transport',
    });
});

test('returns no update for an unchanged form', () => {
    expect(buildExpenseUpdateParams(original, draft)).toBeNull();
});

test('percents are compared by value: "25.00" is the loaded "25"', () => {
    expect(
        buildExpenseUpdateParams(original, {
            ...draft,
            sharingMode: {
                type: 'PERCENTAGE',
                percentageShares: { 'user-1': '25.00', 'user-2': '75.0000' },
            },
        }),
    ).toBeNull();
});

test('exact amounts are compared by ledger units; a missing one is zero', () => {
    const exact: ExpenseModalOriginalState = {
        ...original,
        participantIds: ['user-1'],
        sharingMode: {
            type: 'EXACT',
            customShares: { 'user-1': money(1_200_000n), 'user-2': money(0n) },
        },
    };

    expect(
        buildExpenseUpdateParams(exact, {
            ...draft,
            participantIds: ['user-1'],
            sharingMode: { type: 'EXACT', customShares: { 'user-1': money(1_200_000n) } },
        }),
    ).toBeNull();
});

test('detects split mode and allocation changes', () => {
    const sharingMode: ExpenseDraftSharingMode = {
        type: 'EXACT',
        customShares: { 'user-1': money(600_000n), 'user-2': money(600_000n) },
    };

    expect(buildExpenseUpdateParams(original, { ...draft, sharingMode })).toEqual({
        amount: money(1_200_000n),
        participantIds: ['user-1', 'user-2'],
        sharingMode,
    });
});
