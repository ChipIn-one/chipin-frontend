// Spec 04 §2.11 item 4 (04-2d): the open expense draft survives an app reload.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { SS_KEY_EXPENSE_DRAFT } from 'constants/localstorage';
import { onBeforeAppReload, reloadApp, resetAppUpdateForTests } from 'helpers/appUpdate';
import {
    clearLocalUserIdentity,
    LocalStorage,
    resetTabUserId,
    saveLocalUser,
    SessionStorage,
} from 'helpers/localStorage';
import { currencyCode, fromUnits } from 'shared/money';
import {
    type ExpenseModalSource,
    type ExpenseParticipant,
    useExpenseModalStore,
} from 'store/expenseModalStore';

import {
    decodeWithBigInt,
    encodeWithBigInt,
    restoreExpenseDraftAfterReload,
    saveExpenseDraftForReload,
    startExpenseDraftReload,
} from './expenseDraftReload';

const SETTINGS = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

const me = { id: 'user-1', displayName: 'Me', picture: null } satisfies ExpenseParticipant;
const friend = { id: 'user-2', displayName: 'Friend', picture: null } satisfies ExpenseParticipant;

const source = (overrides: Partial<ExpenseModalSource> = {}): ExpenseModalSource => ({
    context: 'friends',
    currentUser: me,
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    skipCategory: false,
    groups: [],
    knownFriends: [friend],
    ...overrides,
});

const signIn = (userId: string) => {
    saveLocalUser({ id: userId, settings: SETTINGS });
};

const openCreateDraft = () => {
    const store = useExpenseModalStore.getState();

    store.initialize(source());
    store.setDescription('Taxi to the airport');
    store.setAmount('42.50');
};

const openEditDraft = () => {
    useExpenseModalStore.getState().initializeEdit({
        mode: 'edit',
        source: source(),
        targetMode: 'friends',
        groupId: '',
        selectedFriendId: friend.id,
        description: 'Dinner',
        amount: '120',
        currency: 'USD',
        category: 'food',
        paidById: me.id,
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        percentShares: {},
        amountShares: { [me.id]: '20', [friend.id]: '100' },
        shareWeights: { [me.id]: '1', [friend.id]: '1' },
        includedParticipantIds: { [me.id]: true, [friend.id]: true },
        isPercentManuallyEdited: false,
        editContext: {
            entryId: 'entry-1',
            original: {
                description: 'Dinner',
                // Beyond 2^53 ledger units: a number would lose it.
                amount: fromUnits(90_071_992_547_409_930n, currencyCode('USD')),
                payerId: me.id,
                participantIds: [me.id, friend.id],
                currency: 'USD',
                category: 'food',
                subcategory: null,
                sharingMode: {
                    type: 'EXACT',
                    customShares: {
                        [me.id]: fromUnits(200_000n, currencyCode('USD')),
                        [friend.id]: fromUnits(1_000_000n, currencyCode('USD')),
                    },
                },
            },
        },
    });
};

const savedRaw = () => SessionStorage.getRaw(SS_KEY_EXPENSE_DRAFT);

beforeEach(() => {
    sessionStorage.clear();
    LocalStorage.clear();
    resetTabUserId();
    resetAppUpdateForTests();
    useExpenseModalStore.getState().reset();
    signIn(me.id);
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
});

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    LocalStorage.clear();
    resetTabUserId();
    resetAppUpdateForTests();
    useExpenseModalStore.getState().reset();
});

describe('the bigint codec', () => {
    test('round-trips bigint values, also beyond the safe integer range', () => {
        const value = { minor: -90_071_992_547_409_930n, list: [0n, 1n], text: 'x', n: 1.5 };

        expect(decodeWithBigInt(encodeWithBigInt(value))).toEqual(value);
    });

    test('leaves an object that only looks like a tag but is not one', () => {
        expect(decodeWithBigInt('{"a":{"$bigint":"1.5"},"b":{"$bigint":"1","c":2}}')).toEqual({
            a: { $bigint: '1.5' },
            b: { $bigint: '1', c: 2 },
        });
    });
});

describe('save and restore', () => {
    test('a create draft survives the reload and the modal keeps it over its initialize', () => {
        openCreateDraft();
        const before = useExpenseModalStore.getState();
        onBeforeAppReload(saveExpenseDraftForReload);

        reloadApp();
        expect(savedRaw()).not.toBeNull();
        // Minimal data: a create draft is saved without its source (names of the people).
        expect(savedRaw()).not.toContain('displayName');

        useExpenseModalStore.getState().reset();
        expect(restoreExpenseDraftAfterReload()).toBe(true);
        expect(savedRaw()).toBeNull();

        // The modal opens on mount and initializes with the live source: the draft wins.
        const liveSource = source({ knownFriends: [friend, { ...friend, id: 'user-3' }] });
        useExpenseModalStore.getState().initialize(liveSource);

        const after = useExpenseModalStore.getState();
        expect(after).toMatchObject({
            isOpened: true,
            mode: 'create',
            description: 'Taxi to the airport',
            amount: '42.50',
            date: before.date,
            selectedFriendId: before.selectedFriendId,
            clientEntryId: before.clientEntryId,
            ownerId: me.id,
            source: liveSource,
        });

        // Only the first initialize after a restore keeps the draft.
        useExpenseModalStore.getState().reset();
        useExpenseModalStore.getState().initialize(source());
        expect(useExpenseModalStore.getState().description).toBe('');
    });

    test('an edit draft round-trips its Money (bigint) and its participants', () => {
        openEditDraft();
        const before = useExpenseModalStore.getState();

        saveExpenseDraftForReload();
        useExpenseModalStore.getState().reset();
        expect(restoreExpenseDraftAfterReload()).toBe(true);

        const after = useExpenseModalStore.getState();
        expect(after.isOpened).toBe(true);
        expect(after.mode).toBe('edit');
        expect(after.editContext).toEqual(before.editContext);
        expect(after.editContext?.original.amount.minor).toBe(90_071_992_547_409_930n);
        expect(after.source.knownFriends).toEqual([friend]);
        expect(after.amountShares).toEqual(before.amountShares);
    });

    test('the draft is restored once', () => {
        openCreateDraft();
        saveExpenseDraftForReload();
        useExpenseModalStore.getState().reset();

        expect(restoreExpenseDraftAfterReload()).toBe(true);
        useExpenseModalStore.getState().reset();
        expect(restoreExpenseDraftAfterReload()).toBe(false);
        expect(useExpenseModalStore.getState().isOpened).toBe(false);
    });

    test('a closed modal saves nothing and removes an older saved draft', () => {
        SessionStorage.setRaw(SS_KEY_EXPENSE_DRAFT, 'old');

        saveExpenseDraftForReload();

        expect(savedRaw()).toBeNull();
    });

    test('startExpenseDraftReload restores, then saves before every reload', () => {
        openCreateDraft();
        saveExpenseDraftForReload();
        useExpenseModalStore.getState().reset();

        startExpenseDraftReload();
        expect(useExpenseModalStore.getState().isOpened).toBe(true);
        expect(savedRaw()).toBeNull();

        reloadApp();
        expect(savedRaw()).not.toBeNull();
    });
});

describe("foreign, corrupt or another user's data is dropped", () => {
    test.each([
        ['not JSON', '{oops'],
        ['another version', JSON.stringify({ v: 2, userId: me.id, draft: {} })],
        ['a wrong shape', JSON.stringify({ v: 1, userId: me.id, draft: { mode: 'create' } })],
        ['a bad bigint', '{"v":1,"userId":"user-1","draft":{"editContext":{"$bigint":"x"}}}'],
    ])('%s', (_name, raw) => {
        SessionStorage.setRaw(SS_KEY_EXPENSE_DRAFT, raw);

        expect(restoreExpenseDraftAfterReload()).toBe(false);
        expect(savedRaw()).toBeNull();
        expect(useExpenseModalStore.getState().isOpened).toBe(false);
    });

    test('a bad currency inside a Money is dropped', () => {
        openEditDraft();
        saveExpenseDraftForReload();
        SessionStorage.setRaw(
            SS_KEY_EXPENSE_DRAFT,
            (savedRaw() ?? '').replace(/"currency":"USD"\}/g, '"currency":"usd"}'),
        );
        useExpenseModalStore.getState().reset();

        expect(restoreExpenseDraftAfterReload()).toBe(false);
    });

    test('the draft of another user is not restored', () => {
        openCreateDraft();
        saveExpenseDraftForReload();
        useExpenseModalStore.getState().reset();

        signIn('user-9');

        expect(restoreExpenseDraftAfterReload()).toBe(false);
        expect(savedRaw()).toBeNull();
        expect(useExpenseModalStore.getState().isOpened).toBe(false);
    });

    test('nothing is restored after a sign-out', () => {
        openCreateDraft();
        saveExpenseDraftForReload();
        useExpenseModalStore.getState().reset();

        clearLocalUserIdentity();

        expect(restoreExpenseDraftAfterReload()).toBe(false);
    });

    test('a draft owned by another user is never saved', () => {
        openCreateDraft();
        useExpenseModalStore.setState({ ownerId: 'user-9' });

        saveExpenseDraftForReload();

        expect(savedRaw()).toBeNull();
    });
});

// M1: a reload from the error fallback must not bring back a draft that may have crashed the app.
test('a reload without the draft (the error fallback) saves nothing and removes an older draft', () => {
    openCreateDraft();
    SessionStorage.setRaw(SS_KEY_EXPENSE_DRAFT, 'old');
    onBeforeAppReload(saveExpenseDraftForReload);

    reloadApp({ keepDraft: false });

    expect(savedRaw()).toBeNull();
});

// L4: an edit draft stores only the people its form shows.
test('an edit draft does not store unrelated groups or friends', () => {
    const stranger = { id: 'user-8', displayName: 'Stranger', picture: null };
    const groupMate = { id: 'user-7', displayName: 'Group mate', picture: null };
    openEditDraft();
    useExpenseModalStore.setState(state => ({
        source: {
            ...state.source,
            groups: [
                { id: 'other-group', name: 'Other trip', members: [me, stranger] },
                { id: 'entry-group', name: 'Dinner club', members: [me, groupMate] },
            ],
            knownFriends: [friend, stranger],
        },
        editContext: state.editContext && { ...state.editContext, groupId: 'entry-group' },
    }));

    saveExpenseDraftForReload();
    const raw = savedRaw() ?? '';

    expect(raw).not.toContain('Stranger');
    expect(raw).not.toContain('Other trip');
    expect(raw).toContain('Group mate');

    useExpenseModalStore.getState().reset();
    expect(restoreExpenseDraftAfterReload()).toBe(true);
    const restored = useExpenseModalStore.getState().source;
    expect(restored.currentUser).toEqual(me);
    expect(restored.groups.map(group => group.id)).toEqual(['entry-group']);
    expect(restored.knownFriends).toEqual([friend]);
});
