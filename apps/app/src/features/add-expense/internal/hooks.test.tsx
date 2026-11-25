import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { activityKeys } from 'entities/activity';
import {
    capabilitiesQueryOptions,
    type ExpenseDraftSharingMode,
    ledgerKeys,
} from 'entities/ledger';
import {
    getAuthSessionVersion,
    invalidateAuthSession,
    isAuthSessionSwitchedSince,
} from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import {
    LedgerWriteRefusedError,
    startUserLedgerOutbox,
    toastLedgerWriteError,
} from 'hooks/useLedgerMutations';
import { currencyCode, fromUnits } from 'shared/money';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import type { ExpenseModalEditInitialization, ExpenseModalSource } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import {
    outboxConflictDraft,
    pendingOutboxOps,
    resetOutbox,
    storeConflictDrafts,
} from 'test/outbox';
import { mountAsUserClient } from 'test/userClient';

import { useExpenseModalOpenChange, useExpenseModalSubmit } from './hooks';

import 'fake-indexeddb/auto';
import 'i18n/index';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

// The real module; `toastLedgerWriteError` is also recorded: its call is the moment the caller got
// the outcome of a rejected write.
vi.mock('hooks/useLedgerMutations', async importOriginal => {
    const actual = await importOriginal<typeof import('hooks/useLedgerMutations')>();

    return { ...actual, toastLedgerWriteError: vi.fn(actual.toastLedgerWriteError) };
});

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
};

const friend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
};

const originalSharingMode: ExpenseDraftSharingMode = { type: 'AUTO' };

const editInitialization: ExpenseModalEditInitialization = {
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
    amount: '20',
    currency: 'USD',
    category: 'food',
    paidById: currentUser.id,
    splitMode: 'equal',
    percentShares: { [currentUser.id]: '50', [friend.id]: '50' },
    amountShares: { [currentUser.id]: '0', [friend.id]: '0' },
    shareWeights: { [currentUser.id]: '1', [friend.id]: '1' },
    includedParticipantIds: { [currentUser.id]: true, [friend.id]: true },
    isPercentManuallyEdited: false,
    editContext: {
        entryId: 'entry-1',
        parentActivityId: 'activity-1',
        original: {
            description: 'Dinner',
            amount: fromUnits(200_000n, currencyCode('USD')),
            payerId: currentUser.id,
            participantIds: [currentUser.id, friend.id],
            currency: 'USD',
            category: 'food',
            subcategory: 'restaurants',
            sharingMode: originalSharingMode,
        },
    },
};

const server = setupMswServer();

interface Deferred {
    promise: Promise<void>;
    resolve: () => void;
}

const deferred = (): Deferred => {
    let resolve = (): void => undefined;
    const promise = new Promise<void>(done => {
        resolve = done;
    });

    return { promise, resolve };
};

interface SentWrite {
    method: string;
    path: string;
    body: unknown;
}

const selfFeedKey = activityKeys.self({ view: 'previews' });
const historyKey = activityKeys.children('activity-1');

// The expense history of `activity-1` (`activity.children`) was invalidated on this client.
const isHistoryStale = (client: QueryClient): boolean =>
    client.getQueryState(historyKey)?.isInvalidated === true;

// The user's activity feed (`activity.self`) was invalidated on this client.
const isFeedStale = (client: QueryClient): boolean =>
    client.getQueryState(selfFeedKey)?.isInvalidated === true;

// Records every cancel or invalidation on `client` that targets the user's activity feeds
// (`['activity','self']`), whether or not the client is cleared afterwards.
const watchSelfFeedRefreshes = (client: QueryClient): (() => unknown[]) => {
    const invalidations = vi.spyOn(client, 'invalidateQueries');
    const cancels = vi.spyOn(client, 'cancelQueries');

    return () =>
        [...invalidations.mock.calls, ...cancels.mock.calls].filter(([filters]) => {
            const key = filters?.queryKey;

            return key?.[0] === 'activity' && key[1] === 'self';
        });
};

// Signed in as the current user on its persisted client (the only place ledger writes run), with
// the user's activity feed and the expense history of `activity-1` cached.
const signIn = (): QueryClient => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    saveLocalUser({
        id: currentUser.id,
        settings: {
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
        },
    });
    const client = mountAsUserClient(currentUser.id);

    client.setQueryData(selfFeedKey, { pages: [], pageParams: [] });
    client.setQueryData(historyKey, { pages: [], pageParams: [] });
    return client;
};

// The ledger writes, recorded in order; `gate` holds the answer, `status` 400 rejects it. The
// group reads answer the refresh after a group expense.
const serveLedger = ({ gate, status = 200 }: { gate?: Deferred; status?: number } = {}) => {
    const sent: SentWrite[] = [];
    const write = async ({ request }: { request: Request }): Promise<Response> => {
        const body: unknown = await request.json();

        sent.push({
            method: request.method,
            path: new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger'),
            body,
        });
        await gate?.promise;
        return status === 200
            ? HttpResponse.json({ id: 'entry-1' })
            : HttpResponse.json({ code: 'VALIDATION.INVALID' }, { status });
    };

    server.use(
        http.post('*/ledger/entries', write),
        http.patch('*/ledger/entries/:id', write),
        http.get('*/groups/group-1/activity-previews', () =>
            HttpResponse.json({ items: [], nextCursor: null }),
        ),
        http.get('*/groups/group-1', () => HttpResponse.json(wireGroup('group-1'))),
    );
    return sent;
};

const sourceFor = (
    context: ExpenseModalSource['context'],
    overrides: Partial<ExpenseModalSource> = {},
): ExpenseModalSource => ({
    context,
    currentUser,
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    skipCategory: false,
    groups: [{ id: 'group-1', name: 'Trip', members: [currentUser, friend] }],
    knownFriends: [friend],
    ...overrides,
});

// Opens the create form as the entry point does and fills what the user must type.
const openCreate = (source: ExpenseModalSource): void => {
    const store = useExpenseModalStore.getState();

    store.initialize(source);
    store.setDescription('Dinner');
    store.setAmount('20');
    store.setDate(1_717_200_000);
};

const createdExpense = {
    description: 'Dinner',
    amount: 20,
    date: 1_717_200_000,
    payerId: currentUser.id,
    participantIds: [currentUser.id, friend.id],
    currency: 'USD',
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

const submit = (onClose: () => void = vi.fn()) => {
    const hook = renderHook(() => useExpenseModalSubmit(onClose));

    act(() => {
        hook.result.current.onSubmit();
    });
    return hook;
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
    vi.clearAllMocks();
});

afterEach(() => {
    onlineManager.setOnline(true);
    useExpenseModalStore.getState().reset();
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('runs the lifecycle callback when the modal is initially open', () => {
    const onOpenChange = vi.fn();

    renderHook(() => useExpenseModalOpenChange(true, onOpenChange));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('runs the lifecycle callback when the modal opens', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ isOpened }) => useExpenseModalOpenChange(isOpened, onOpenChange),
        { initialProps: { isOpened: false } },
    );

    expect(onOpenChange).not.toHaveBeenCalled();

    rerender({ isOpened: true });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('does not rerun when only the callback identity changes', () => {
    const firstOnOpenChange = vi.fn();
    const secondOnOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ onOpenChange }) => useExpenseModalOpenChange(true, onOpenChange),
        { initialProps: { onOpenChange: firstOnOpenChange } },
    );

    rerender({ onOpenChange: secondOnOpenChange });

    expect(firstOnOpenChange).toHaveBeenCalledTimes(1);
    expect(secondOnOpenChange).not.toHaveBeenCalled();
});

test('creates a group expense from the dashboard: one request, the modal closes with a toast, the feeds reload', async () => {
    const client = signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    openCreate(sourceFor('dashboard'));
    submit(onClose);

    await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
    expect(sent).toEqual([
        {
            method: 'POST',
            path: '/ledger/entries',
            body: { type: 'EXPENSE', groupId: 'group-1', expense: createdExpense },
        },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Expense added successfully!');
    expect(toast.error).not.toHaveBeenCalled();
    expect(isFeedStale(client)).toBe(true);
});

test('creates an expense from a group page in that group', async () => {
    signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    openCreate(
        sourceFor('group', {
            groups: [
                { id: 'group-0', name: 'Other', members: [currentUser, friend] },
                { id: 'group-1', name: 'Trip', members: [currentUser, friend] },
            ],
            defaultGroupId: 'group-1',
        }),
    );
    submit(onClose);

    await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
    expect(sent.map(({ body }) => body)).toEqual([
        { type: 'EXPENSE', groupId: 'group-1', expense: createdExpense },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Expense added successfully!');
});

test('creates an expense with a friend from the friends page: no group in the request', async () => {
    signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    openCreate(sourceFor('friends', { preferredFriendId: friend.id }));
    submit(onClose);

    await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
    expect(sent.map(({ body }) => body)).toEqual([{ type: 'EXPENSE', expense: createdExpense }]);
    expect(toast.success).toHaveBeenCalledWith('Expense added successfully!');
});

test('edits an expense from the activity history: a patch of the changed fields, the modal closes with a toast, the history reloads', async () => {
    const client = signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    useExpenseModalStore.getState().initializeEdit(editInitialization);
    useExpenseModalStore.getState().setDescription('Lunch');
    submit(onClose);

    await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
    expect(sent).toEqual([
        {
            method: 'PATCH',
            path: '/ledger/entries/entry-1',
            body: { type: 'EXPENSE', expense: { description: 'Lunch' } },
        },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Expense updated successfully!');
    expect(isHistoryStale(client)).toBe(true);
});

test('an unchanged edit and an invalid form send nothing', () => {
    signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    useExpenseModalStore.getState().initializeEdit(editInitialization);
    submit(onClose);
    openCreate(sourceFor('dashboard'));
    useExpenseModalStore.getState().setAmount('');
    submit(onClose);

    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
});

test('a double submit sends one request and shows one toast', async () => {
    signIn();
    const gate = deferred();
    const sent = serveLedger({ gate });
    const onClose = vi.fn();

    openCreate(sourceFor('dashboard'));
    const { result } = submit(onClose);

    act(() => {
        result.current.onSubmit();
    });
    await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
    });
    act(() => {
        result.current.onSubmit();
    });
    gate.resolve();

    await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
    });
    expect(sent).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
});

test('the submitting flag is the mutation state: on while the request runs, off after a failure', async () => {
    signIn();
    const gate = deferred();

    serveLedger({ gate, status: 400 });
    useExpenseModalStore.getState().initializeEdit(editInitialization);
    useExpenseModalStore.getState().setDescription('Lunch');
    const { result } = renderHook(() => useExpenseModalSubmit(vi.fn()));

    expect(result.current.isSubmitting).toBe(false);
    act(() => {
        result.current.onSubmit();
    });
    await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
    });
    gate.resolve();
    await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
    });
});

test('a failed request keeps the modal open with the form intact and shows the translated API error', async () => {
    const client = signIn();
    const sent = serveLedger({ status: 400 });
    const onClose = vi.fn();

    openCreate(sourceFor('dashboard'));
    const before = useExpenseModalStore.getState();

    submit(onClose);

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Validation failed for the request');
    });
    expect(sent).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(useExpenseModalStore.getState()).toEqual(before);
    // The views of a rejected write are read again (spec 03 §2.1); the toast does not wait.
    await waitFor(() => {
        expect(isFeedStale(client)).toBe(true);
    });
});

test('a failed update keeps the edit open with the edited form', async () => {
    signIn();
    serveLedger({ status: 400 });
    const onClose = vi.fn();

    useExpenseModalStore.getState().initializeEdit(editInitialization);
    useExpenseModalStore.getState().setDescription('Lunch');
    submit(onClose);

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Validation failed for the request');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(useExpenseModalStore.getState().description).toBe('Lunch');
    expect(useExpenseModalStore.getState().mode).toBe('edit');
});

test('an offline submit is refused with a toast: the modal stays open and nothing is sent after the reconnect', async () => {
    signIn();
    const sent = serveLedger();
    const onClose = vi.fn();

    onlineManager.setOnline(false);
    openCreate(sourceFor('dashboard'));
    const { result } = submit(onClose);

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('No internet connection');
    });
    act(() => {
        onlineManager.setOnline(true);
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(useExpenseModalStore.getState().description).toBe('Dinner');
});

test('a signed-out submit is refused: nothing is sent, the modal stays, no toast (the session is over)', async () => {
    const sent = serveLedger();
    const onClose = vi.fn();

    openCreate(sourceFor('dashboard'));
    submit(onClose);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
});

// Another tab switched the account: this tab's token refresh returns the other user's token. The
// auth session version moves as a switch, not a session end, and the previous user's data and client
// go (spec 03 §1.5, #641).
const switchAccountInAnotherTab = (): void => {
    const sessionVersion = getAuthSessionVersion();

    // The data of the next user, which the switch loads: none of it matters here.
    server.use(
        http.get('*/users/*', () => HttpResponse.json({}, { status: 500 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    act(() => {
        onAccessTokenRefreshed(fakeAccessToken('user-2'));
    });
    expect(getAuthSessionVersion()).toBe(sessionVersion + 1);
    expect(isAuthSessionSwitchedSince(sessionVersion)).toBe(true);
};

// The submit rejected as an ended session: the caller has its outcome, whatever the answer was.
const waitForSessionRefusal = (): Promise<void> =>
    waitFor(() => {
        expect(toastLedgerWriteError).toHaveBeenCalledWith(
            new LedgerWriteRefusedError('session'),
            expect.any(String),
        );
    });

describe.each<[string, () => void]>([
    ['a sign-out', invalidateAuthSession],
    ['an account switch in another tab', switchAccountInAnotherTab],
])('a submit answered after %s', (_name, endSession) => {
    test.each<[string, number]>([
        ['saved', 200],
        ['rejected', 400],
    ])(
        'a %s expense shows no toast and does not close the modal of the next session',
        async (_outcome, status) => {
            const selfFeedRefreshes = watchSelfFeedRefreshes(signIn());
            const gate = deferred();
            const sent = serveLedger({ gate, status });
            const onClose = vi.fn();

            openCreate(sourceFor('dashboard'));
            const { result } = submit(onClose);

            await waitFor(() => {
                expect(sent).toHaveLength(1);
            });
            endSession();
            gate.resolve();
            await waitForSessionRefusal();
            expect(result.current.isSubmitting).toBe(false);

            expect(onClose).not.toHaveBeenCalled();
            expect(toast.success).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
            expect(selfFeedRefreshes()).toEqual([]);
        },
    );

    test('an edit answered then shows no toast and does not close the modal either', async () => {
        const client = signIn();
        const gate = deferred();
        const sent = serveLedger({ gate });
        const onClose = vi.fn();

        useExpenseModalStore.getState().initializeEdit(editInitialization);
        useExpenseModalStore.getState().setDescription('Lunch');
        submit(onClose);

        await waitFor(() => {
            expect(sent).toHaveLength(1);
        });
        endSession();
        gate.resolve();
        await waitForSessionRefusal();

        expect(onClose).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        expect(isHistoryStale(client)).toBe(false);
    });
});

describe('03-16a with offline writes on', () => {
    const signInWithOutbox = async (): Promise<QueryClient> => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = signIn();

        await clear();
        await startUserLedgerOutbox(client, currentUser.id);
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
        return client;
    };

    afterEach(() => {
        resetOutbox();
        vi.unstubAllEnvs();
    });

    test('03-15b R1 L5: a queued create shows one toast, the outbox one; the form says nothing of a created expense', async () => {
        await signInWithOutbox();
        const sent = serveLedger();
        const onClose = vi.fn();

        onlineManager.setOnline(false);
        openCreate(sourceFor('dashboard'));
        submit(onClose);

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledOnce();
        });
        expect(vi.mocked(toast.success).mock.calls).toEqual([
            ['Saved, we will send it when the network is back'],
        ]);
        expect(toast.error).not.toHaveBeenCalled();
        expect(sent).toEqual([]);
    });

    test('§2.7: the client entry id is made when the form opens; a repeated submit queues one op with it', async () => {
        await signInWithOutbox();
        serveLedger();
        const onClose = vi.fn();

        onlineManager.setOnline(false);
        openCreate(sourceFor('dashboard'));
        const { clientEntryId } = useExpenseModalStore.getState();
        const { result } = submit(onClose);

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledOnce();
        });
        act(() => {
            result.current.onSubmit();
        });
        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(2);
        });

        expect(clientEntryId).toEqual(expect.any(String));
        expect(pendingOutboxOps()).toEqual([
            expect.objectContaining({ kind: 'createExpense', entryId: clientEntryId }),
        ]);
        // A new opening of the form makes a new id.
        openCreate(sourceFor('dashboard'));
        expect(useExpenseModalStore.getState().clientEntryId).not.toBe(clientEntryId);
    });

    describe('03-16b the form opened on a conflict draft (§2.6)', () => {
        // entry-1 has a conflict draft; the form is open on it.
        const openOnDraft = async (): Promise<QueryClient> => {
            vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
            const client = signIn();

            await clear();
            await storeConflictDrafts(currentUser.id, {
                'entry-1': {
                    entryId: 'entry-1',
                    groupId: null,
                    parentActivityId: 'activity-1',
                    fields: { description: 'Lunch' },
                    createdAt: 5,
                },
            });
            await startUserLedgerOutbox(client, currentUser.id);
            client.setQueryData(capabilitiesQueryOptions().queryKey, [
                'ledger.clientEntryId',
                'ledger.entryVersion',
                'client.minVersion',
            ]);
            useExpenseModalStore.getState().initializeEdit(editInitialization);
            useExpenseModalStore.getState().setDescription('Lunch');
            useConflictDraftStore.getState().setOpened('entry-1');
            return client;
        };

        afterEach(() => {
            useConflictDraftStore.getState().reset();
        });

        test('Save queued: one op based on the cached current version, the draft gone in the same write', async () => {
            const client = await openOnDraft();
            const sent = serveLedger();
            const onClose = vi.fn();

            client.setQueryData(ledgerKeys.entry('entry-1'), {
                id: 'entry-1',
                type: 'EXPENSE',
                version: 'v50',
                updatedAt: 100,
                groupId: null,
                expense: null,
            });
            onlineManager.setOnline(false);
            submit(onClose);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledOnce();
            });
            expect(pendingOutboxOps()).toEqual([
                expect.objectContaining({
                    kind: 'updateExpense',
                    entryId: 'entry-1',
                    baseVersion: 'v50',
                    patch: { description: 'Lunch' },
                }),
            ]);
            expect(outboxConflictDraft('entry-1')).toBeNull();
            expect(useConflictDraftStore.getState().openedEntryId).toBeNull();
            expect(sent).toEqual([]);
        });

        test('R1 M1: a form not opened on the draft (opened before the conflict, or on an unreadable draft) keeps it when its edit is queued', async () => {
            const client = await openOnDraft();

            useConflictDraftStore.getState().setOpened(null);
            client.setQueryData(ledgerKeys.entry('entry-1'), {
                id: 'entry-1',
                type: 'EXPENSE',
                version: 'v50',
                updatedAt: 100,
                groupId: null,
                expense: null,
            });
            onlineManager.setOnline(false);
            const onClose = vi.fn();

            submit(onClose);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledOnce();
            });
            expect(pendingOutboxOps()).toHaveLength(1);
            expect(outboxConflictDraft('entry-1')).toMatchObject({
                fields: { description: 'Lunch' },
            });
        });

        test('Save answered online (the entry not cached): one PATCH, then the draft is removed', async () => {
            await openOnDraft();
            const sent = serveLedger();
            const onClose = vi.fn();

            submit(onClose);

            await waitFor(() => {
                expect(outboxConflictDraft('entry-1')).toBeNull();
            });
            expect(onClose).toHaveBeenCalledOnce();
            expect(sent).toEqual([
                expect.objectContaining({ method: 'PATCH', path: '/ledger/entries/entry-1' }),
            ]);
        });

        test('nothing left to change: the draft is removed and the form closes, no request', async () => {
            await openOnDraft();
            const sent = serveLedger();
            const onClose = vi.fn();

            useExpenseModalStore.getState().setDescription('Dinner');
            submit(onClose);

            await waitFor(() => {
                expect(outboxConflictDraft('entry-1')).toBeNull();
            });
            expect(onClose).toHaveBeenCalledOnce();
            expect(sent).toEqual([]);
        });
    });
});

test('§2.7: an edit has no client entry id', () => {
    useExpenseModalStore.getState().initializeEdit(editInitialization);

    expect(useExpenseModalStore.getState().clientEntryId).toBeNull();
});
