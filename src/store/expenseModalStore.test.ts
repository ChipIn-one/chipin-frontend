import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    selectExpensePayload,
    selectIncludedUsers,
    selectIsSubmitDisabled,
    selectIsUserLocked,
    selectPayerId,
    selectSplitSummary,
    selectUserIds,
} from './expenseModalSelectors';
import {
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
} satisfies ExpenseParticipant;

const friend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
} satisfies ExpenseParticipant;

const groupMember = {
    id: 'user-3',
    displayName: 'Group member',
    picture: null,
} satisfies ExpenseParticipant;

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('initializes a group expense with equal split defaults', () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'AED',
        defaultCategory: 'transport',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [groupMember, currentUser] }],
        knownFriends: [friend],
        defaultGroupId: 'group-1',
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.currency).toBe('AED');
    expect(state.category).toBe('transport');
    expect(selectUserIds(state)).toEqual([
        currentUser.id,
        groupMember.id,
    ]);
    expect(state.includedParticipantIds).toEqual({
        [currentUser.id]: true,
        [groupMember.id]: true,
    });
    expect(selectPayerId(state)).toBe(currentUser.id);
});

test('builds a null category payload when category selection is skipped', () => {
    const store = useExpenseModalStore.getState();

    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'transport',
        skipCategory: true,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setAmount('100');

    const state = useExpenseModalStore.getState();

    expect(state.category).toBe('');
    expect(state.source.skipCategory).toBe(true);
    expect(selectExpensePayload(state, 1_717_200_000)?.category).toBeNull();
});

test('owns the global modal opening context', () => {
    const store = useExpenseModalStore.getState();

    store.open({
        context: 'friends',
        friendId: friend.id,
    });

    expect(useExpenseModalStore.getState()).toMatchObject({
        isOpened: true,
        openingContext: 'friends',
        openingFriendId: friend.id,
    });

    store.setIsOpened(false);

    expect(useExpenseModalStore.getState()).toMatchObject({
        isOpened: false,
        openingContext: undefined,
        openingFriendId: undefined,
    });
});

test('keeps a direct expense limited to current user and one known friend', () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, groupMember],
        preferredFriendId: friend.id,
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(selectUserIds(state)).toEqual([
        currentUser.id,
        friend.id,
    ]);
    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([
        currentUser.id,
        friend.id,
    ]);
    expect(selectIsUserLocked(state, currentUser.id)).toBe(true);
    expect(selectIsUserLocked(state, friend.id)).toBe(true);
});

test('replaces the selected dashboard friend and clears progress when none is selected', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, groupMember],
    });
    store.setAmount('100');
    store.setParticipantIncluded(groupMember.id, true);

    expect(
        selectIncludedUsers(useExpenseModalStore.getState()).map(
            user => user.id,
        ),
    ).toEqual([currentUser.id, groupMember.id]);

    store.setParticipantIncluded(groupMember.id, false);

    const state = useExpenseModalStore.getState();

    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([
        currentUser.id,
    ]);
    expect(selectSplitSummary(state).assignedAmount).toBe(0);
    expect(selectSplitSummary(state).totalAmount).toBe(100);
    expect(selectIsSubmitDisabled(state)).toBe(true);
});

test('allows a group payer to be excluded from the expense participants', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setDescription('Dinner');
    store.setAmount('100');
    store.setParticipantIncluded(currentUser.id, false);

    const state = useExpenseModalStore.getState();
    const payload = selectExpensePayload(state, 1_717_200_000);

    expect(selectPayerId(state)).toBe(currentUser.id);
    expect(selectSplitSummary(state).yourShareAmount).toBe(0);
    expect(payload?.participantIds).toEqual([groupMember.id]);
});

test('allows submitting an expense without a description', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setAmount('100');

    const state = useExpenseModalStore.getState();

    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(selectExpensePayload(state, 1_717_200_000)?.description).toBe('');
});

test('disables a group expense when the current user is the only group member', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setAmount('100');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
});

test('builds shares payload and validation from store state', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend],
        preferredFriendId: friend.id,
    });
    store.setDescription('Dinner');
    store.setAmount('120');
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '1');
    store.setSplitValue(friend.id, '2');

    const state = useExpenseModalStore.getState();
    const payload = selectExpensePayload(state, 1_717_200_000);

    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(payload).toEqual({
        description: 'Dinner',
        amount: 120,
        date: 1_717_200_000,
        payerId: currentUser.id,
        participantIds: [currentUser.id, friend.id],
        currency: 'USD',
        category: state.category,
        sharingMode: {
            type: 'SHARES',
            shares: {
                [currentUser.id]: 1,
                [friend.id]: 2,
            },
        },
    });
});
