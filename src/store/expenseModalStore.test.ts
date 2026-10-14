import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';

import {
    selectExpensePayload,
    selectIncludedUsers,
    selectIsSubmitDisabled,
    selectShouldShowSelfOnlyCallout,
    selectShouldShowOtherDirectZeroDebtWarning,
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

afterEach(() => {
    vi.useRealTimers();
});

test('initializes a create date once through the editor lifecycle', () => {
    const currentDate = new Date(2026, 6, 27, 20, 5);
    vi.useFakeTimers();
    vi.setSystemTime(currentDate);

    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend],
        preferredFriendId: friend.id,
    });

    expect(useExpenseModalStore.getState().date).toBe(
        Math.floor(currentDate.getTime() / 1000),
    );
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

test('EXP-063 prefers a usable friend over an unspendable group on Dashboard', () => {
    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser] }],
        knownFriends: [friend],
        defaultGroupId: 'group-1',
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(state.selectedFriendId).toBe(friend.id);
});

test('EXP-063 prefers a multi-member group over a default single-member group on Dashboard', () => {
    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            { id: 'group-1', members: [currentUser] },
            {
                id: 'group-2',
                members: [currentUser, groupMember],
            },
        ],
        knownFriends: [friend],
        defaultGroupId: 'group-1',
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe('group-2');
});

test('EXP-060 keeps a one-member group available in group context', () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser] }],
        knownFriends: [friend],
        defaultGroupId: 'group-1',
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe('group-1');
});

test('EXP-060 defaults to a single-member group when no direct friend exists', () => {
    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser] }],
        knownFriends: [],
    });

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe('group-1');
    expect(selectIsSubmitDisabled(state)).toBe(true);
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

test('disables Save for an unchanged valid edit', () => {
    useExpenseModalStore.getState().initializeEdit({
        mode: 'edit',
        source: {
            context: 'friends',
            currentUser,
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            skipCategory: false,
            groups: [],
            knownFriends: [friend],
        },
        targetMode: 'friends',
        groupId: '',
        selectedFriendId: friend.id,
        description: 'Dinner',
        amount: '120',
        currency: 'USD',
        category: 'food',
        paidById: currentUser.id,
        splitMode: EXPENSE_SPLIT_MODES.PERCENT,
        percentShares: { [currentUser.id]: '25', [friend.id]: '75' },
        amountShares: { [currentUser.id]: '0', [friend.id]: '0' },
        shareWeights: { [currentUser.id]: '1', [friend.id]: '1' },
        includedParticipantIds: { [currentUser.id]: true, [friend.id]: true },
        isPercentManuallyEdited: true,
        editContext: {
            entryId: 'entry-1',
            original: {
                description: 'Dinner',
                amount: 120,
                payerId: currentUser.id,
                participantIds: [currentUser.id, friend.id],
                currency: 'USD',
                category: 'food',
                subcategory: 'restaurants',
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { [currentUser.id]: 25, [friend.id]: 75 },
                },
            },
        },
    });

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
});

const initializeDirectZeroDebtTest = () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend],
        preferredFriendId: friend.id,
    });
    useExpenseModalStore.getState().setAmount('10');
};

test.each([
    { mode: EXPENSE_SPLIT_MODES.SHARES, payer: '1', other: '0', validPayer: '0', validOther: '1', wire: 'SHARES' },
    { mode: EXPENSE_SPLIT_MODES.PERCENT, payer: '100', other: '0', validPayer: '0', validOther: '100', wire: 'PERCENTAGE' },
    { mode: EXPENSE_SPLIT_MODES.AMOUNTS, payer: '10', other: '0', validPayer: '0', validOther: '10', wire: 'EXACT' },
])('rejects self-paid zero-debt direct $wire splits and accepts positive counterparty amounts', ({ mode, payer, other, validPayer, validOther, wire }) => {
    initializeDirectZeroDebtTest();
    const store = useExpenseModalStore.getState();
    store.setSplitMode(mode);
    store.setSplitValue(currentUser.id, payer);
    store.setSplitValue(friend.id, other);

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
    expect(selectExpensePayload(useExpenseModalStore.getState())).toBeNull();
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(true);

    store.setSplitValue(currentUser.id, validPayer);
    store.setSplitValue(friend.id, validOther);

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(false);
    expect(selectExpensePayload(useExpenseModalStore.getState())?.sharingMode?.type).toBe(wire);
});

test('rejects zero non-payer share when the friend paid, without showing the self-only Callout', () => {
    initializeDirectZeroDebtTest();
    const store = useExpenseModalStore.getState();
    store.setPaidById(friend.id);
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '0');
    store.setSplitValue(friend.id, '1');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(true);

    store.setSplitValue(currentUser.id, '1');
    store.setSplitValue(friend.id, '0');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(false);
});

test('rounds tiny direct Shares allocations at four decimal places', () => {
    initializeDirectZeroDebtTest();
    const store = useExpenseModalStore.getState();
    store.setAmount('0.0001');
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '1000');
    store.setSplitValue(friend.id, '1');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(true);

    store.setSplitValue(currentUser.id, '0');
    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
});

test('keeps equal direct splits and group expenses with zero-share members valid', () => {
    initializeDirectZeroDebtTest();
    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
    expect(selectExpensePayload(useExpenseModalStore.getState())?.sharingMode?.type).toBe('AUTO');

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
    store.setAmount('10');
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '1');
    store.setSplitValue(groupMember.id, '0');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(false);
});

test.each([
    { mode: EXPENSE_SPLIT_MODES.SHARES, all: '1', positive: '1' },
    { mode: EXPENSE_SPLIT_MODES.PERCENT, all: '100', positive: '50' },
])('rejects an explicit zero counterparty $mode share for amounts above safe monetary units', ({ mode, all, positive }) => {
    initializeDirectZeroDebtTest();
    const store = useExpenseModalStore.getState();
    store.setAmount('900800000000');
    store.setSplitMode(mode);
    store.setSplitValue(currentUser.id, all);
    store.setSplitValue(friend.id, '0');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
    expect(selectExpensePayload(useExpenseModalStore.getState())).toBeNull();
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(true);

    store.setPaidById(friend.id);
    store.setSplitValue(currentUser.id, '0');
    store.setSplitValue(friend.id, all);
    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
    expect(selectShouldShowSelfOnlyCallout(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(true);

    store.setSplitValue(currentUser.id, positive);
    store.setSplitValue(friend.id, positive);
    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
    expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(false);
    expect(selectExpensePayload(useExpenseModalStore.getState())).not.toBeNull();
});
