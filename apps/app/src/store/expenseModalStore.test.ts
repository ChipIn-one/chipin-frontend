import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { currencyCode, fromUnits } from 'shared/money';

import {
    selectDirectExpenseFallbackGroupId,
    selectExpensePayload,
    selectExpenseSubmitFeedback,
    selectIncludedUsers,
    selectIsDirectExpenseWithoutFriend,
    selectIsSubmitDisabled,
    selectIsUserLocked,
    selectPayerId,
    selectShouldShowOtherDirectZeroDebtWarning,
    selectShouldShowSelfOnlyCallout,
    selectSplitSummary,
    selectUserIds,
} from './expenseModalSelectors';
import {
    type ExpenseModalSource,
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

    expect(useExpenseModalStore.getState().date).toBe(Math.floor(currentDate.getTime() / 1000));
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
    expect(selectUserIds(state)).toEqual([currentUser.id, groupMember.id]);
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
    expect(selectUserIds(state)).toEqual([currentUser.id, friend.id]);
    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([currentUser.id, friend.id]);
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

    expect(selectIncludedUsers(useExpenseModalStore.getState()).map(user => user.id)).toEqual([
        currentUser.id,
        groupMember.id,
    ]);

    store.setParticipantIncluded(groupMember.id, false);

    const state = useExpenseModalStore.getState();

    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([currentUser.id]);
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
        amount: fromUnits(1_200_000n, currencyCode('USD')),
        date: 1_717_200_000,
        payerId: currentUser.id,
        participantIds: [currentUser.id, friend.id],
        category: state.category,
        sharingMode: {
            type: 'SHARES',
            shares: {
                [currentUser.id]: '1',
                [friend.id]: '2',
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
                amount: fromUnits(1_200_000n, currencyCode('USD')),
                payerId: currentUser.id,
                participantIds: [currentUser.id, friend.id],
                currency: 'USD',
                category: 'food',
                subcategory: 'restaurants',
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { [currentUser.id]: '25', [friend.id]: '75' },
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
    {
        mode: EXPENSE_SPLIT_MODES.SHARES,
        payer: '1',
        other: '0',
        validPayer: '0',
        validOther: '1',
        wire: 'SHARES',
    },
    {
        mode: EXPENSE_SPLIT_MODES.PERCENT,
        payer: '100',
        other: '0',
        validPayer: '0',
        validOther: '100',
        wire: 'PERCENTAGE',
    },
    {
        mode: EXPENSE_SPLIT_MODES.AMOUNTS,
        payer: '10',
        other: '0',
        validPayer: '0',
        validOther: '10',
        wire: 'EXACT',
    },
])(
    'rejects self-paid zero-debt direct $wire splits and accepts positive counterparty amounts',
    ({ mode, payer, other, validPayer, validOther, wire }) => {
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
    },
);

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
])(
    'rejects an explicit zero counterparty $mode share for amounts above safe monetary units',
    ({ mode, all, positive }) => {
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
        expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(
            true,
        );

        store.setSplitValue(currentUser.id, positive);
        store.setSplitValue(friend.id, positive);
        expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);
        expect(selectShouldShowOtherDirectZeroDebtWarning(useExpenseModalStore.getState())).toBe(
            false,
        );
        expect(selectExpensePayload(useExpenseModalStore.getState())).not.toBeNull();
    },
);

// #718: the groups list loads after the create modal opened on a group page.
const groupPageSource = (groups: { id: string; members: ExpenseParticipant[] }[]) => ({
    context: 'group' as const,
    currentUser,
    defaultCurrency: 'AED',
    defaultCategory: 'transport',
    skipCategory: false,
    groups,
    knownFriends: [friend],
    defaultGroupId: 'group-1',
});

test('EXP-063 a late groups list fills the default group of a create modal opened without one', () => {
    useExpenseModalStore.getState().initialize(groupPageSource([]));
    useExpenseModalStore
        .getState()
        .applyLateGroups(groupPageSource([{ id: 'group-1', members: [groupMember, currentUser] }]));

    const state = useExpenseModalStore.getState();

    expect(state.groupId).toBe('group-1');
    expect(selectUserIds(state)).toEqual([currentUser.id, groupMember.id]);
    expect(state.paidById).toBe(currentUser.id);
});

test('EXP-063 a late groups list keeps a group the user already chose', () => {
    const groups = [
        { id: 'group-1', members: [groupMember, currentUser] },
        { id: 'group-2', members: [friend, currentUser] },
    ];

    useExpenseModalStore.getState().initialize(groupPageSource(groups));
    useExpenseModalStore.getState().setGroupId('group-2');
    useExpenseModalStore.getState().applyLateGroups({ ...groupPageSource(groups) });

    expect(useExpenseModalStore.getState().groupId).toBe('group-2');
});

test('EXP-063 a late groups list keeps a friend target the user already chose', () => {
    useExpenseModalStore.getState().initialize(groupPageSource([]));
    useExpenseModalStore.getState().setTargetMode('friends');
    useExpenseModalStore
        .getState()
        .applyLateGroups(groupPageSource([{ id: 'group-1', members: [groupMember, currentUser] }]));

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(state.groupId).toBe('');
    expect(state.source.groups.map(group => group.id)).toEqual(['group-1']);

    useExpenseModalStore.getState().setGroupId('group-1');

    expect(selectUserIds(useExpenseModalStore.getState())).toEqual([
        currentUser.id,
        groupMember.id,
    ]);
});

test('EXP-063 a group page never falls back to another group when its own is not listed', () => {
    useExpenseModalStore.getState().initialize({
        ...groupPageSource([{ id: 'group-2', members: [friend, currentUser] }]),
        defaultGroupId: 'group-9',
    });

    expect(useExpenseModalStore.getState().groupId).toBe('');
});

test('EXP-063 a group-page modal keeps its own group when a later source names another', () => {
    useExpenseModalStore
        .getState()
        .initialize({ ...groupPageSource([]), defaultGroupId: 'group-9' });
    // Back to the dashboard: the source now defaults to the dashboard's group.
    useExpenseModalStore.getState().applyLateGroups({
        ...groupPageSource([{ id: 'group-1', members: [groupMember, currentUser] }]),
        context: 'dashboard',
        defaultGroupId: 'group-1',
    });

    const state = useExpenseModalStore.getState();

    expect(state.groupId).toBe('');
    expect(state.source.defaultGroupId).toBe('group-9');
    expect(state.source.groups.map(group => group.id)).toEqual(['group-1']);
});

// KB EXP-067: a dashboard direct expense opened before any mutual known user exists.
const noFriendSource = (overrides: Partial<ExpenseModalSource> = {}): ExpenseModalSource => ({
    context: 'dashboard' as const,
    currentUser,
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    skipCategory: false,
    groups: [],
    knownFriends: [],
    ...overrides,
});

const openDirectWithoutFriend = (overrides: Partial<ExpenseModalSource> = {}): void => {
    useExpenseModalStore.getState().initialize(noFriendSource(overrides));
    useExpenseModalStore.getState().setTargetMode('friends');
};

test('EXP-067 a direct create without a known friend is the no-friend state with no submit feedback', () => {
    openDirectWithoutFriend();

    const state = useExpenseModalStore.getState();

    expect(selectIsDirectExpenseWithoutFriend(state)).toBe(true);
    expect(selectIsSubmitDisabled(state)).toBe(true);
    expect(selectExpenseSubmitFeedback(state)).toBeNull();
    expect(selectExpensePayload(state)).toBeNull();

    useExpenseModalStore.getState().setTargetMode('group');

    expect(selectIsDirectExpenseWithoutFriend(useExpenseModalStore.getState())).toBe(false);
});

test('EXP-067 an edit or a direct create with a known friend is not the no-friend state', () => {
    openDirectWithoutFriend({ knownFriends: [friend] });

    expect(selectIsDirectExpenseWithoutFriend(useExpenseModalStore.getState())).toBe(false);

    useExpenseModalStore.setState({ mode: 'edit', source: noFriendSource() });

    expect(selectIsDirectExpenseWithoutFriend(useExpenseModalStore.getState())).toBe(false);
});

test('EXP-067 the fallback group is the chosen eligible group, else the first eligible one', () => {
    const soloGroup = { id: 'group-solo', members: [currentUser] };
    const firstPair = { id: 'group-1', members: [groupMember, currentUser] };
    const secondPair = { id: 'group-2', members: [friend, currentUser] };

    openDirectWithoutFriend({ groups: [soloGroup, firstPair, secondPair] });
    useExpenseModalStore.setState({ groupId: soloGroup.id });

    expect(selectDirectExpenseFallbackGroupId(useExpenseModalStore.getState())).toBe(firstPair.id);

    useExpenseModalStore.setState({ groupId: secondPair.id });

    expect(selectDirectExpenseFallbackGroupId(useExpenseModalStore.getState())).toBe(secondPair.id);
});

test('EXP-067 no fallback group without a group of two or more members', () => {
    openDirectWithoutFriend({ groups: [{ id: 'group-solo', members: [currentUser] }] });

    expect(selectDirectExpenseFallbackGroupId(useExpenseModalStore.getState())).toBe('');
});

test('EXP-067 a known friend arriving while open makes the direct expense usable, keeping the draft', () => {
    openDirectWithoutFriend();
    useExpenseModalStore.getState().setDescription('Dinner');
    useExpenseModalStore.getState().setAmount('42');

    useExpenseModalStore
        .getState()
        .applyLateKnownFriends(noFriendSource({ knownFriends: [friend] }));

    const state = useExpenseModalStore.getState();

    expect(selectIsDirectExpenseWithoutFriend(state)).toBe(false);
    expect(state.targetMode).toBe('friends');
    expect(state.selectedFriendId).toBe(friend.id);
    expect(state.description).toBe('Dinner');
    expect(state.amount).toBe('42');
    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([currentUser.id, friend.id]);
    expect(selectPayerId(state)).toBe(currentUser.id);
    expect(selectIsSubmitDisabled(state)).toBe(false);
    expect(selectExpensePayload(state)).toMatchObject({
        payerId: currentUser.id,
        participantIds: [currentUser.id, friend.id],
    });
});

test('EXP-067 a later known friend keeps the chosen friend and joins unselected', () => {
    const otherFriend = { id: 'user-4', displayName: 'Other', picture: null };

    openDirectWithoutFriend({ knownFriends: [friend] });
    useExpenseModalStore.getState().setAmount('10');
    useExpenseModalStore
        .getState()
        .applyLateKnownFriends(noFriendSource({ knownFriends: [friend, otherFriend] }));

    const state = useExpenseModalStore.getState();

    expect(state.selectedFriendId).toBe(friend.id);
    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([currentUser.id, friend.id]);
    expect(selectIsSubmitDisabled(state)).toBe(false);
});

test('EXP-067 known friends arriving do not change a group-mode draft beyond the source', () => {
    const pair = { id: 'group-1', members: [groupMember, currentUser] };

    useExpenseModalStore.getState().initialize(noFriendSource({ groups: [pair] }));
    useExpenseModalStore.getState().setAmount('10');

    const before = useExpenseModalStore.getState();

    useExpenseModalStore
        .getState()
        .applyLateKnownFriends(noFriendSource({ groups: [pair], knownFriends: [friend] }));

    const after = useExpenseModalStore.getState();

    expect(after.targetMode).toBe('group');
    expect(after.groupId).toBe(pair.id);
    expect(after.selectedFriendId).toBe(before.selectedFriendId);
    expect(after.includedParticipantIds).toEqual(before.includedParticipantIds);
    expect(after.source.knownFriends).toEqual([friend]);
});

test('EXP-067 known friends arriving do not touch an edit draft', () => {
    useExpenseModalStore.setState({
        isOpened: true,
        mode: 'edit',
        targetMode: 'friends',
        source: noFriendSource(),
    });
    useExpenseModalStore
        .getState()
        .applyLateKnownFriends(noFriendSource({ knownFriends: [friend] }));

    expect(useExpenseModalStore.getState().source.knownFriends).toEqual([]);
});

test('EXP-067 a selected friend restored before the friends loaded stays included when they arrive', () => {
    const otherFriend = { id: 'user-4', displayName: 'Other', picture: null };

    openDirectWithoutFriend();
    useExpenseModalStore.setState({ selectedFriendId: friend.id, amount: '10' });
    useExpenseModalStore
        .getState()
        .applyLateKnownFriends(noFriendSource({ knownFriends: [friend, otherFriend] }));

    const state = useExpenseModalStore.getState();

    expect(state.selectedFriendId).toBe(friend.id);
    expect(state.includedParticipantIds[otherFriend.id]).toBe(false);
    expect(selectIncludedUsers(state).map(user => user.id)).toEqual([currentUser.id, friend.id]);
    expect(selectExpensePayload(state)).toMatchObject({
        payerId: currentUser.id,
        participantIds: [currentUser.id, friend.id],
    });
});
