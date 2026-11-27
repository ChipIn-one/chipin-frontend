import { beforeEach, expect, test } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { currencyCode, fromUnits } from 'shared/money';

import {
    type ExpenseModalFriend,
    type ExpenseModalGroup,
    type ExpenseModalSource,
    type ExpenseParticipant,
    resolveExpenseModalCurrency,
    useExpenseModalStore,
} from './expenseModalStore';

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
} satisfies ExpenseParticipant;

const groupMember = {
    id: 'user-2',
    displayName: 'Group member',
    picture: null,
} satisfies ExpenseParticipant;

const group = (id: string, lastSelectedCurrency?: string | null): ExpenseModalGroup => ({
    id,
    members: [currentUser, groupMember],
    lastSelectedCurrency,
});

const friend = (id: string, lastSelectedCurrency?: string | null): ExpenseModalFriend => ({
    id,
    displayName: `Friend ${id}`,
    picture: null,
    lastSelectedCurrency,
});

const source = (overrides: Partial<ExpenseModalSource> = {}): ExpenseModalSource => ({
    context: 'dashboard',
    currentUser,
    defaultCurrency: 'USD',
    lastSelectedCurrency: null,
    defaultCategory: 'food',
    skipCategory: false,
    groups: [group('group-1')],
    knownFriends: [],
    defaultGroupId: 'group-1',
    ...overrides,
});

const currency = () => useExpenseModalStore.getState().currency;

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('EXP-072 a group expense starts with the viewer last selected currency in that group, over the global one and the default', () => {
    useExpenseModalStore.getState().initialize(
        source({
            context: 'group',
            lastSelectedCurrency: 'EUR',
            groups: [group('group-1', 'VND')],
        }),
    );

    expect(currency()).toBe('VND');
});

test('EXP-072 a direct expense starts with the viewer last selected currency with that friend, over the global one and the default', () => {
    useExpenseModalStore.getState().initialize(
        source({
            context: 'friends',
            lastSelectedCurrency: 'EUR',
            groups: [],
            knownFriends: [friend('friend-1', 'THB')],
            preferredFriendId: 'friend-1',
        }),
    );

    expect(useExpenseModalStore.getState().targetMode).toBe('friends');
    expect(currency()).toBe('THB');
});

test('EXP-072 the global last selected currency starts a group or a direct expense whose target has none', () => {
    const store = useExpenseModalStore.getState();

    store.initialize(source({ lastSelectedCurrency: 'EUR', groups: [group('group-1', null)] }));
    expect(currency()).toBe('EUR');

    store.reset();
    store.initialize(
        source({
            context: 'friends',
            lastSelectedCurrency: 'EUR',
            groups: [],
            knownFriends: [friend('friend-1', null)],
        }),
    );
    expect(currency()).toBe('EUR');
});

test('EXP-072 the default currency starts an expense without any last selected currency', () => {
    useExpenseModalStore.getState().initialize(source({ defaultCurrency: 'GBP' }));

    expect(currency()).toBe('GBP');
});

test('EXP-072 the app fallback starts an expense when no preference and no default are known', () => {
    useExpenseModalStore
        .getState()
        .initialize(source({ defaultCurrency: null, lastSelectedCurrency: undefined }));

    expect(currency()).toBe('USD');
    expect(
        resolveExpenseModalCurrency(source({ defaultCurrency: null }), {
            targetMode: 'group',
            groupId: 'group-1',
            selectedFriendId: '',
        }),
    ).toEqual({ currency: 'USD', source: 'fallback' });
});

test('EXP-072 the resolver names the source of the automatic currency for each target', () => {
    const withPreferences = source({
        lastSelectedCurrency: 'EUR',
        groups: [group('group-1', 'VND'), group('group-2')],
        knownFriends: [friend('friend-1', 'THB'), friend('friend-2')],
    });
    const target = (targetMode: 'group' | 'friends', id: string) => ({
        targetMode,
        groupId: targetMode === 'group' ? id : '',
        selectedFriendId: targetMode === 'friends' ? id : '',
    });

    expect(resolveExpenseModalCurrency(withPreferences, target('group', 'group-1'))).toEqual({
        currency: 'VND',
        source: 'context',
    });
    expect(resolveExpenseModalCurrency(withPreferences, target('group', 'group-2'))).toEqual({
        currency: 'EUR',
        source: 'global',
    });
    expect(resolveExpenseModalCurrency(withPreferences, target('friends', 'friend-1'))).toEqual({
        currency: 'THB',
        source: 'context',
    });
    expect(
        resolveExpenseModalCurrency(
            { ...withPreferences, lastSelectedCurrency: null },
            target('friends', 'friend-2'),
        ),
    ).toEqual({ currency: 'USD', source: 'default' });
});

test('EXP-073 a picked currency is kept over late groups, a target change and a refreshed source', () => {
    const store = useExpenseModalStore.getState();

    store.initialize(
        source({
            groups: [],
            knownFriends: [friend('friend-1', 'THB')],
            defaultGroupId: undefined,
        }),
    );
    store.setTargetMode('group');
    store.setCurrency('JPY');
    // The groups list (and newer preferences) arrive after the pick.
    store.applyLateGroups(
        source({ lastSelectedCurrency: 'EUR', groups: [group('group-1', 'VND')] }),
    );
    expect(useExpenseModalStore.getState().groupId).toBe('group-1');
    expect(currency()).toBe('JPY');

    store.setTargetMode('friends');
    store.setGroupId('group-1');
    expect(currency()).toBe('JPY');
    expect(useExpenseModalStore.getState().isCurrencyManuallyEdited).toBe(true);
});

test('EXP-073 an untouched currency follows the late groups with the newest preferences', () => {
    const store = useExpenseModalStore.getState();

    store.initialize(source({ context: 'group', groups: [], defaultGroupId: 'group-1' }));
    expect(currency()).toBe('USD');

    store.applyLateGroups(
        source({
            context: 'group',
            lastSelectedCurrency: 'EUR',
            groups: [group('group-1', 'VND')],
            defaultGroupId: 'group-1',
        }),
    );
    expect(currency()).toBe('VND');
});

test('EXP-073 an untouched currency is recomputed when the group, the target or the friend changes', () => {
    const store = useExpenseModalStore.getState();

    store.initialize(
        source({
            lastSelectedCurrency: 'EUR',
            groups: [group('group-1', 'VND'), group('group-2', null)],
            knownFriends: [friend('friend-1', 'THB'), friend('friend-2', 'KHR')],
        }),
    );
    expect(currency()).toBe('VND');

    store.setGroupId('group-2');
    expect(currency()).toBe('EUR');

    store.setTargetMode('friends');
    expect(useExpenseModalStore.getState().selectedFriendId).toBe('friend-1');
    expect(currency()).toBe('THB');

    store.setParticipantIncluded('friend-2', true);
    expect(useExpenseModalStore.getState().selectedFriendId).toBe('friend-2');
    expect(currency()).toBe('KHR');

    // No friend chosen: the automatic currency stays as it was.
    store.setParticipantIncluded('friend-2', false);
    expect(useExpenseModalStore.getState().selectedFriendId).toBe('');
    expect(currency()).toBe('KHR');

    store.setGroupId('group-1');
    expect(currency()).toBe('VND');
    expect(useExpenseModalStore.getState().isCurrencyManuallyEdited).toBe(false);
});

test('EXP-073 editing an expense keeps its stored currency over the preferences and a target change', () => {
    const store = useExpenseModalStore.getState();
    const editSource = source({
        lastSelectedCurrency: 'EUR',
        groups: [group('group-1', 'VND'), group('group-2', 'THB')],
    });

    store.initializeEdit({
        mode: 'edit',
        source: editSource,
        targetMode: 'group',
        groupId: 'group-1',
        selectedFriendId: '',
        description: 'Dinner',
        amount: '10',
        currency: 'JPY',
        category: 'food',
        paidById: currentUser.id,
        splitMode: EXPENSE_SPLIT_MODES.EQUAL,
        percentShares: {},
        amountShares: {},
        shareWeights: {},
        includedParticipantIds: { [currentUser.id]: true, [groupMember.id]: true },
        isPercentManuallyEdited: false,
        editContext: {
            entryId: 'entry-1',
            groupId: 'group-1',
            original: {
                description: 'Dinner',
                amount: fromUnits(100_000n, currencyCode('JPY')),
                payerId: currentUser.id,
                participantIds: [currentUser.id, groupMember.id],
                currency: 'JPY',
                category: 'food',
                subcategory: null,
                sharingMode: { type: 'AUTO' },
            },
        },
    });
    expect(currency()).toBe('JPY');

    store.setGroupId('group-2');
    store.applyLateGroups(editSource);
    expect(currency()).toBe('JPY');
});

test('EXP-073 after a create the next new expense starts from the refreshed last selected currency', () => {
    const store = useExpenseModalStore.getState();

    store.initialize(source({ lastSelectedCurrency: null, groups: [group('group-1', null)] }));
    expect(currency()).toBe('USD');
    store.setCurrency('VND');
    store.close();

    // The create reloaded the self user and the group: the modal reopens on the refreshed source.
    store.initialize(source({ lastSelectedCurrency: 'VND', groups: [group('group-1', 'VND')] }));
    expect(currency()).toBe('VND');
    expect(useExpenseModalStore.getState().isCurrencyManuallyEdited).toBe(false);

    store.close();
    store.initialize(source({ lastSelectedCurrency: 'VND', groups: [group('group-2', null)] }));
    expect(useExpenseModalStore.getState().groupId).toBe('group-2');
    expect(currency()).toBe('VND');
});

test('EXP-072 a source without the new fields (an older cache or backend) falls through to the default', () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'GBP',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [{ id: 'friend-1', displayName: 'Friend', picture: null }],
        defaultGroupId: 'group-1',
    });
    expect(currency()).toBe('GBP');

    useExpenseModalStore.getState().setTargetMode('friends');
    expect(currency()).toBe('GBP');
});

test('#706 EXP-064 a USD split amount "100." switched to JPY can still be edited around its separator', () => {
    const store = useExpenseModalStore.getState();
    store.initialize(source({ context: 'group' }));
    store.setSplitMode(EXPENSE_SPLIT_MODES.AMOUNTS);
    store.setSplitValue(currentUser.id, '100.');
    store.setCurrency('JPY');

    const share = () => useExpenseModalStore.getState().amountShares[currentUser.id];

    useExpenseModalStore.getState().setSplitValue(currentUser.id, '10.');
    expect(share()).toBe('10.');
    useExpenseModalStore.getState().setSplitValue(currentUser.id, '10.5');
    expect(share()).toBe('10.');
    useExpenseModalStore.getState().setSplitValue(currentUser.id, '200');
    expect(share()).toBe('200');
    // Once the separator is gone, a JPY split amount does not take it back (#706).
    useExpenseModalStore.getState().setSplitValue(currentUser.id, '200.');
    expect(share()).toBe('200');
});

test('EXP-073 refreshed preferences for the same groups and friends update an untouched currency, never a picked one or an edit', () => {
    const store = useExpenseModalStore.getState();
    const stale = source({ groups: [group('group-1', 'USD')], knownFriends: [friend('friend-1')] });

    store.initialize(stale);
    expect(currency()).toBe('USD');

    store.applyLateGroups({ ...stale, groups: [group('group-1', 'VND')] });
    expect(currency()).toBe('VND');
    expect(useExpenseModalStore.getState().source.groups[0]?.lastSelectedCurrency).toBe('VND');

    store.setTargetMode('friends');
    expect(currency()).toBe('USD');
    store.applyLateGroups({
        ...stale,
        lastSelectedCurrency: 'EUR',
        groups: [group('group-1', 'VND')],
        knownFriends: [friend('friend-1', 'THB')],
    });
    expect(currency()).toBe('THB');

    // Nothing new: the state is the same object.
    const before = useExpenseModalStore.getState();
    store.applyLateGroups({
        ...stale,
        lastSelectedCurrency: 'EUR',
        groups: [group('group-1', 'VND')],
        knownFriends: [friend('friend-1', 'THB')],
    });
    expect(useExpenseModalStore.getState()).toBe(before);

    store.setCurrency('JPY');
    store.applyLateGroups({ ...stale, knownFriends: [friend('friend-1', 'KHR')] });
    expect(currency()).toBe('JPY');
});

test('EXP-073 a restored draft keeps its automatic friend currency until the known users arrive, then follows them', () => {
    const store = useExpenseModalStore.getState();
    const withFriend = (lastSelectedCurrency: string) =>
        source({
            context: 'friends',
            lastSelectedCurrency: 'EUR',
            groups: [],
            knownFriends: [friend('friend-1', lastSelectedCurrency)],
            preferredFriendId: 'friend-1',
        });

    store.initialize(withFriend('THB'));
    expect(currency()).toBe('THB');
    const { isOpened: _isOpened, source: _source, ...fields } = useExpenseModalStore.getState();

    // An app reload: the draft is restored before the known users are cached.
    store.reset();
    store.restoreDraft({ ...fields, source: null });
    const beforeFriends = source({
        context: 'friends',
        lastSelectedCurrency: 'EUR',
        groups: [],
        knownFriends: [],
        preferredFriendId: 'friend-1',
    });
    store.initialize(beforeFriends);
    expect(currency()).toBe('THB');

    const before = useExpenseModalStore.getState();
    store.applyLateGroups(beforeFriends);
    expect(useExpenseModalStore.getState()).toBe(before);
    expect(currency()).toBe('THB');

    // The known users arrive: the store takes them, and the untouched currency follows them.
    store.applyLateGroups(withFriend('THB'));
    expect(useExpenseModalStore.getState().source.knownFriends.map(item => item.id)).toEqual([
        'friend-1',
    ]);
    expect(currency()).toBe('THB');

    store.applyLateGroups(withFriend('KHR'));
    expect(currency()).toBe('KHR');
    expect(useExpenseModalStore.getState().isCurrencyManuallyEdited).toBe(false);
});
