import { expect, test } from 'vitest';

import type { CreateLedgerEntryParams, SharingMode } from 'api/chipin.types';

import {
    buildExpenseUpdateParams,
    type ExpenseModalOriginalState,
} from './expenseModalUpdate';

const original: ExpenseModalOriginalState = {
    description: 'Dinner',
    amount: 120,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    currency: 'USD',
    category: 'food',
    subcategory: 'restaurants',
    sharingMode: {
        type: 'PERCENTAGE',
        percentageShares: { 'user-1': 25, 'user-2': 75 },
    },
};

const draft: CreateLedgerEntryParams = {
    description: 'Dinner',
    amount: 120,
    date: 1_700_000_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    currency: 'USD',
    category: 'food',
    sharingMode: original.sharingMode,
};

test('builds a description-only partial update', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, description: 'Lunch' })).toEqual({
        type: 'EXPENSE',
        expense: { description: 'Lunch' },
    });
});

test('represents an intentionally cleared description as null', () => {
    expect(buildExpenseUpdateParams(original, { ...draft, description: '' })).toEqual({
        type: 'EXPENSE',
        expense: { description: null },
    });
});

test('includes payer and currency without sending a changed date', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        payerId: 'user-2',
        currency: 'EUR',
        date: 1_700_000_001,
    })).toEqual({
        type: 'EXPENSE',
        expense: {
            payerId: 'user-2',
            currency: 'EUR',
        },
    });
});

test('does not create an update for a date-only change', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        date: 1_700_000_001,
    })).toBeNull();
});

test('sends the complete atomic split block when amount changes', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        amount: 150,
    })).toEqual({
        type: 'EXPENSE',
        expense: {
            amount: 150,
            participantIds: ['user-1', 'user-2'],
            sharingMode: original.sharingMode,
        },
    });
});

test('does not treat participant ordering as a split change', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        participantIds: ['user-2', 'user-1'],
    })).toBeNull();
});

test('does not send category or hidden subcategory when category is unchanged', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        description: 'Updated dinner',
    })).toEqual({
        type: 'EXPENSE',
        expense: { description: 'Updated dinner' },
    });
});

test('sends a changed category without stale subcategory', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        category: 'transport',
    })).toEqual({
        type: 'EXPENSE',
        expense: { category: 'transport' },
    });
});

test('returns no update for an unchanged form', () => {
    expect(buildExpenseUpdateParams(original, draft)).toBeNull();
});

test('detects split mode and allocation changes', () => {
    const sharingMode: SharingMode = {
        type: 'EXACT',
        customShares: { 'user-1': 60, 'user-2': 60 },
    };

    expect(buildExpenseUpdateParams(original, {
        ...draft,
        sharingMode,
    })).toMatchObject({
        expense: {
            amount: 120,
            participantIds: ['user-1', 'user-2'],
            sharingMode,
        },
    });
});
