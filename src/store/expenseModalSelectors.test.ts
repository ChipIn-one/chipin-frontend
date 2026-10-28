import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import { selectSplitSummary, selectUserAmount } from './expenseModalSelectors';
import { type ExpenseParticipant, useExpenseModalStore } from './expenseModalStore';

const user = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
} satisfies ExpenseParticipant;

const friend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
} satisfies ExpenseParticipant;

const initializeGroup = (amount: string) => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser: user,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [friend, user] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    useExpenseModalStore.getState().setDescription('Dinner');
    useExpenseModalStore.getState().setAmount(amount);
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('rounds an EQUAL half-way share half-up (3.015 / 1 -> 3.02)', () => {
    initializeGroup('3.015');
    useExpenseModalStore.getState().setParticipantIncluded(friend.id, false);

    expect(selectUserAmount(useExpenseModalStore.getState(), user.id)).toBe(3.02);
});

test('rounds a PERCENT half-way share half-up', () => {
    initializeGroup('2.01');
    useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    useExpenseModalStore.getState().setSplitValue(user.id, '50');
    useExpenseModalStore.getState().setSplitValue(friend.id, '50');

    expect(selectUserAmount(useExpenseModalStore.getState(), user.id)).toBe(1.01);
    expect(selectSplitSummary(useExpenseModalStore.getState()).assignedAmount).toBe(2.01);
});

test('keeps non-half-way EQUAL shares unchanged', () => {
    initializeGroup('100');

    expect(selectUserAmount(useExpenseModalStore.getState(), user.id)).toBe(50);
    expect(selectUserAmount(useExpenseModalStore.getState(), friend.id)).toBe(50);
});

test('steps an AMOUNTS value and keeps two decimals', () => {
    initializeGroup('10');
    useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    useExpenseModalStore.getState().setSplitValue(user.id, '1.25');
    useExpenseModalStore.getState().stepSplitValue(user.id, 1);

    expect(useExpenseModalStore.getState().amountShares[user.id]).toBe('2.25');
});
