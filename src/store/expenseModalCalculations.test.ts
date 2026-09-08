import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    selectExpensePayload,
    selectSplitSummary,
    selectUserAmount,
    selectYourShareColor,
} from './expenseModalSelectors';
import {
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

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

const thirdUser = {
    id: 'user-3',
    displayName: 'Third',
    picture: null,
} satisfies ExpenseParticipant;

const initializeGroup = (users = [friend, user]) => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser: user,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: users }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    useExpenseModalStore.getState().setDescription('Dinner');
    useExpenseModalStore.getState().setAmount('100');
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('puts the current user first and distributes percent defaults evenly', () => {
    initializeGroup([friend, thirdUser, user]);

    const state = useExpenseModalStore.getState();

    expect(state.percentShares).toEqual({
        [user.id]: '34',
        [friend.id]: '33',
        [thirdUser.id]: '33',
    });
});

test('calculates equal, percent, amount, and shares splits', () => {
    initializeGroup();

    expect(selectSplitSummary(useExpenseModalStore.getState())).toMatchObject({
        assignedAmount: 100,
        yourShareAmount: 50,
    });

    useExpenseModalStore
        .getState()
        .setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    useExpenseModalStore.getState().setSplitValue(user.id, '60');
    useExpenseModalStore.getState().setSplitValue(friend.id, '40');

    expect(selectSplitSummary(useExpenseModalStore.getState())).toMatchObject({
        assignedAmount: 100,
        yourShareAmount: 60,
    });

    useExpenseModalStore
        .getState()
        .setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    useExpenseModalStore.getState().setSplitValue(user.id, '25');
    useExpenseModalStore.getState().setSplitValue(friend.id, '75');

    expect(selectSplitSummary(useExpenseModalStore.getState())).toMatchObject({
        assignedAmount: 100,
        yourShareAmount: 25,
    });

    useExpenseModalStore
        .getState()
        .setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    useExpenseModalStore.getState().setSplitValue(user.id, '1');
    useExpenseModalStore.getState().setSplitValue(friend.id, '3');

    expect(selectSplitSummary(useExpenseModalStore.getState())).toMatchObject({
        assignedAmount: 100,
        yourShareAmount: 25,
    });
});

test('builds shares payload from included users only', () => {
    initializeGroup([friend, thirdUser, user]);
    useExpenseModalStore
        .getState()
        .setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    useExpenseModalStore.getState().setSplitValue(user.id, '1');
    useExpenseModalStore.getState().setSplitValue(friend.id, '2');
    useExpenseModalStore.getState().setSplitValue(thirdUser.id, '9');
    useExpenseModalStore
        .getState()
        .setParticipantIncluded(thirdUser.id, false);

    expect(
        selectExpensePayload(useExpenseModalStore.getState(), 1),
    ).toMatchObject({
        participantIds: [user.id, friend.id],
        sharingMode: {
            type: 'SHARES',
            shares: {
                [user.id]: 1,
                [friend.id]: 2,
            },
        },
    });
});

test('returns zero amount for an excluded user', () => {
    initializeGroup([friend, thirdUser, user]);
    useExpenseModalStore
        .getState()
        .setParticipantIncluded(thirdUser.id, false);

    expect(selectUserAmount(useExpenseModalStore.getState(), thirdUser.id)).toBe(
        0,
    );
});

test('colors your share based on the payer', () => {
    initializeGroup();

    expect(selectYourShareColor(useExpenseModalStore.getState())).toBe('jade');

    useExpenseModalStore.getState().setPaidById(friend.id);

    expect(selectYourShareColor(useExpenseModalStore.getState())).toBe('red');
});
