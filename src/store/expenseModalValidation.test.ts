import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    selectExpensePayload,
    selectExpenseSubmitFeedback,
    selectIsSubmitDisabled,
    selectShouldShowOtherDirectZeroDebtWarning,
    selectShouldShowSelfOnlyCallout,
    selectSplitSummary,
} from './expenseModalSelectors';
import {
    type ExpenseModalStore,
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

const currentUser = { id: 'user-1', displayName: 'You', picture: null } satisfies ExpenseParticipant;
const friend = { id: 'user-2', displayName: 'Friend', picture: null } satisfies ExpenseParticipant;
const other = { id: 'user-3', displayName: 'Other', picture: null } satisfies ExpenseParticipant;

const initialize = (targetMode: 'group' | 'friends' = 'group'): void => {
    useExpenseModalStore.getState().initialize({
        context: targetMode === 'group' ? 'group' : 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, friend, other] }],
        knownFriends: [friend, other],
        defaultGroupId: 'group-1',
    });
    useExpenseModalStore.getState().setAmount('100');
};

const expectBlocked = (state: ExpenseModalStore): void => {
    expect(selectIsSubmitDisabled(state)).toBe(true);
    expect(selectExpensePayload(state)).toBeNull();
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test.each(['', '0', '-1', 'NaN', 'Infinity', '-Infinity'])(
    'EXP-064 / EXP-001 explains invalid amount %j before any other blocker',
    amount => {
        useExpenseModalStore.getState().setAmount(amount);
        const state = useExpenseModalStore.getState();

        expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'amount' });
        expectBlocked(state);
    },
);

test('EXP-064 identifies a missing group target before missing participants', () => {
    useExpenseModalStore.getState().setAmount('100');
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'target' });
    expectBlocked(state);
});

test('EXP-064 / EXP-001 identifies an empty participant selection before a split mismatch', () => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    store.toggleAllParticipants();
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'participants' });
    expectBlocked(state);
});

test('EXP-064 / EXP-060 identifies a group without enough available members', () => {
    initialize();
    const state = useExpenseModalStore.getState();
    const singleMemberState = {
        ...state,
        source: { ...state.source, groups: [{ id: 'group-1', members: [currentUser] }] },
    };

    expect(selectExpenseSubmitFeedback(singleMemberState)).toEqual({ reason: 'participants' });
    expectBlocked(singleMemberState);
});

test('EXP-064 / EXP-006 identifies a missing direct counterparty', () => {
    initialize('friends');
    useExpenseModalStore.getState().setParticipantIncluded(friend.id, false);
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'participants' });
    expectBlocked(state);
});

test('EXP-064 / EXP-006 identifies a direct selection without the authenticated user', () => {
    initialize('friends');
    const state = useExpenseModalStore.getState();
    const invalidState = {
        ...state,
        includedParticipantIds: { [currentUser.id]: false, [friend.id]: true, [other.id]: true },
    };

    expect(selectExpenseSubmitFeedback(invalidState)).toEqual({ reason: 'participants' });
    expectBlocked(invalidState);
});

test('EXP-064 / EXP-002 and EXP-006 reject duplicate direct participants', () => {
    initialize('friends');
    const state = useExpenseModalStore.getState();
    const invalidState = {
        ...state,
        source: { ...state.source, currentUser: null, knownFriends: [friend, friend] },
    };

    expect(selectExpenseSubmitFeedback(invalidState)).toEqual({ reason: 'participants' });
    expectBlocked(invalidState);
});

test.each([
    { self: '30', friend: '40', current: 70, difference: 30, reason: 'percentUnder' },
    { self: '70', friend: '40', current: 110, difference: 10, reason: 'percentOver' },
])('EXP-064 / EXP-012 reports the raw percentage total for $reason', ({ self, friend: friendValue, current, difference, reason }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setParticipantIncluded(other.id, false);
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, friendValue);
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason, current, required: 100, difference });
    expectBlocked(state);
});

test.each([
    { self: '49', current: 99, reason: 'percentUnder' },
    { self: '51', current: 101, reason: 'percentOver' },
])('EXP-064 / EXP-012 preserves percentage $reason at tiny amounts despite equal rounded money', ({ self, current, reason }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setAmount('0.01');
    store.setParticipantIncluded(other.id, false);
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, '50');
    const state = useExpenseModalStore.getState();

    expect(selectSplitSummary(state).assignedAmount).toBe(0.01);
    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason, current, required: 100, difference: 1 });
    expectBlocked(state);
});

test.each([
    { self: '20', friend: '30', current: 50, difference: 50, reason: 'amountsUnder' },
    { self: '80', friend: '30', current: 110, difference: 10, reason: 'amountsOver' },
])('EXP-064 / EXP-011 reports exact amount $reason', ({ self, friend: friendValue, current, difference, reason }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setParticipantIncluded(other.id, false);
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, friendValue);
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason, current, required: 100, difference });
    expectBlocked(state);
});

test.each([
    { value: '0.999', reason: 'amountsUnder', difference: 0.001 },
    { value: '1.0011', reason: 'amountsOver', difference: 0.0011 },
])('EXP-064 / EXP-011 keeps the existing exact total tolerance for $reason', ({ value, reason, difference }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setAmount('1');
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    // Existing edits may contain API precision beyond the two-decimal input parser.
    const state = {
        ...useExpenseModalStore.getState(),
        amountShares: { [currentUser.id]: value },
    };

    expect(selectExpenseSubmitFeedback(state)).toMatchObject({ reason, current: Number(value), required: 1 });
    expect(selectExpenseSubmitFeedback(state)?.difference).toBeCloseTo(difference, 8);
    expectBlocked(state);
});

test.each(['0.9991', '1.0009'])('EXP-064 / EXP-011 does not reject exact totals within the existing tolerance: %s', value => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setAmount('1');
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    // Existing edits may contain API precision beyond the two-decimal input parser.
    const state = {
        ...useExpenseModalStore.getState(),
        amountShares: { [currentUser.id]: value },
    };

    expect(selectExpenseSubmitFeedback(state)).toBeNull();
    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(selectExpensePayload(state)?.sharingMode).toEqual({
        type: 'EXACT', customShares: { [currentUser.id]: Number(value), [friend.id]: 0, [other.id]: 0 },
    });
});

test('EXP-064 / EXP-013 identifies zero total share weight', () => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '0');
    store.setSplitValue(friend.id, '0');
    store.setSplitValue(other.id, '0');
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'shares', current: 0 });
    expectBlocked(state);
});

test.each([
    { mode: EXPENSE_SPLIT_MODES.PERCENT, included: '70', excluded: '30', reason: 'percentUnder', current: 70 },
    { mode: EXPENSE_SPLIT_MODES.AMOUNTS, included: '70', excluded: '30', reason: 'amountsUnder', current: 70 },
    { mode: EXPENSE_SPLIT_MODES.SHARES, included: '0', excluded: '1', reason: 'shares', current: 0 },
])('EXP-064 ignores excluded users in $mode totals', ({ mode, included, excluded, reason, current }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setSplitMode(mode);
    store.setSplitValue(currentUser.id, included);
    store.setSplitValue(friend.id, '0');
    store.setSplitValue(other.id, excluded);
    store.setParticipantIncluded(other.id, false);
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toMatchObject({ reason, current });
    expectBlocked(state);
});

test.each([
    { mode: EXPENSE_SPLIT_MODES.EQUAL, self: '0', friend: '0', wire: 'AUTO' },
    { mode: EXPENSE_SPLIT_MODES.PERCENT, self: '60', friend: '40', wire: 'PERCENTAGE' },
    { mode: EXPENSE_SPLIT_MODES.AMOUNTS, self: '25', friend: '75', wire: 'EXACT' },
    { mode: EXPENSE_SPLIT_MODES.SHARES, self: '1', friend: '0', wire: 'SHARES' },
])('EXP-064 / EXP-010..EXP-014 leaves valid group $mode submissions available', ({ mode, self, friend: friendValue, wire }) => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setParticipantIncluded(other.id, false);
    store.setSplitMode(mode);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, friendValue);
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toBeNull();
    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(selectExpensePayload(state)?.sharingMode?.type).toBe(wire);
});

test.each([currentUser.id, friend.id])('EXP-064 / EXP-004 preserves direct zero-debt feedback when %s paid', payerId => {
    initialize('friends');
    const store = useExpenseModalStore.getState();
    store.setPaidById(payerId);
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.setSplitValue(currentUser.id, payerId === currentUser.id ? '100' : '0');
    store.setSplitValue(friend.id, payerId === friend.id ? '100' : '0');
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toEqual({ reason: 'noDebt' });
    expectBlocked(state);
    expect(selectShouldShowSelfOnlyCallout(state)).toBe(payerId === currentUser.id);
    expect(selectShouldShowOtherDirectZeroDebtWarning(state)).toBe(payerId !== currentUser.id);
});

test('EXP-064 / EXP-006 leaves valid direct expense submission available', () => {
    initialize('friends');
    const state = useExpenseModalStore.getState();

    expect(selectExpenseSubmitFeedback(state)).toBeNull();
    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(selectExpensePayload(state)?.participantIds).toEqual([currentUser.id, friend.id]);
});

test('EXP-064 updates first actionable feedback as amount, participants, and percentage input change', () => {
    initialize();
    const store = useExpenseModalStore.getState();
    store.setAmount('');
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.toggleAllParticipants();
    expect(selectExpenseSubmitFeedback(useExpenseModalStore.getState())).toEqual({ reason: 'amount' });

    store.setAmount('100');
    expect(selectExpenseSubmitFeedback(useExpenseModalStore.getState())).toEqual({ reason: 'participants' });

    store.setParticipantIncluded(friend.id, true);
    store.setSplitValue(friend.id, '40');
    expect(selectExpenseSubmitFeedback(useExpenseModalStore.getState())).toEqual({
        reason: 'percentUnder', current: 40, required: 100, difference: 60,
    });

    store.setSplitValue(friend.id, '100');
    expect(selectExpenseSubmitFeedback(useExpenseModalStore.getState())).toBeNull();
    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
});

test('EXP-064 / EXP-044 distinguishes unchanged edits from invalid input and clears after a real edit', () => {
    initialize();
    const state = useExpenseModalStore.getState();
    const editState: ExpenseModalStore = {
        ...state,
        mode: 'edit',
        editContext: {
            entryId: 'entry-1',
            original: {
                description: null,
                amount: 100,
                payerId: currentUser.id,
                participantIds: [currentUser.id, friend.id, other.id],
                currency: 'USD',
                category: 'food',
                subcategory: null,
                sharingMode: { type: 'AUTO' },
            },
        },
    };

    expect(selectExpenseSubmitFeedback(editState)).toEqual({ reason: 'unchanged' });
    expect(selectIsSubmitDisabled(editState)).toBe(true);
    expect(selectExpensePayload(editState)?.amount).toBe(100);
    expect(selectExpenseSubmitFeedback({ ...editState, amount: '' })).toEqual({ reason: 'amount' });
    expect(selectExpenseSubmitFeedback({ ...editState, description: 'Dinner' })).toBeNull();
    expect(selectIsSubmitDisabled({ ...editState, description: 'Dinner' })).toBe(false);
});
