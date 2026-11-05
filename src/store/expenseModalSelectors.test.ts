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

test.each([
    { currency: 'KWD', value: '1.235', delta: 1, expected: '2.235' },
    { currency: 'JPY', value: '5', delta: 2, expected: '7' },
    { currency: 'USD', value: '0.5', delta: -1, expected: '0.00' },
])(
    'steps an AMOUNTS value in $currency minor units: $value + $delta -> $expected',
    ({ currency, value, delta, expected }) => {
        initializeGroup('10');
        useExpenseModalStore.getState().setCurrency(currency);
        useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
        useExpenseModalStore.getState().setSplitValue(user.id, value);
        useExpenseModalStore.getState().stepSplitValue(user.id, delta);

        expect(useExpenseModalStore.getState().amountShares[user.id]).toBe(expected);
    },
);

test('limits AMOUNTS input to the currency minor units', () => {
    initializeGroup('10');
    useExpenseModalStore.getState().setCurrency('JPY');
    useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    useExpenseModalStore.getState().setSplitValue(user.id, '5');
    useExpenseModalStore.getState().setSplitValue(user.id, '5.5');

    expect(useExpenseModalStore.getState().amountShares[user.id]).toBe('5');
});

test('erases AMOUNTS digits after a switch to a currency with fewer minor units', () => {
    initializeGroup('10');
    const store = useExpenseModalStore.getState();
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    store.setSplitValue(user.id, '1.25');
    store.setCurrency('JPY');

    for (const text of ['1.2', '1.', '1']) {
        useExpenseModalStore.getState().setSplitValue(user.id, text);
        expect(useExpenseModalStore.getState().amountShares[user.id]).toBe(text);
    }
    // Back at the JPY limit, decimals are not accepted again.
    useExpenseModalStore.getState().setSplitValue(user.id, '1.5');
    expect(useExpenseModalStore.getState().amountShares[user.id]).toBe('1');
});

test('erases an edit-loaded scale-4 AMOUNTS value digit by digit', () => {
    initializeGroup('1');
    useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    useExpenseModalStore.setState({ amountShares: { [user.id]: '0.9991', [friend.id]: '0' } });

    for (const text of ['0.999', '0.99', '0.9']) {
        useExpenseModalStore.getState().setSplitValue(user.id, text);
        expect(useExpenseModalStore.getState().amountShares[user.id]).toBe(text);
    }
    // Within USD cents again: typing up to two decimals works, a third is refused.
    useExpenseModalStore.getState().setSplitValue(user.id, '0.99');
    useExpenseModalStore.getState().setSplitValue(user.id, '0.999');
    expect(useExpenseModalStore.getState().amountShares[user.id]).toBe('0.99');
});
