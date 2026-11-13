import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SharingMode } from 'api/chipin.types';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { LedgerWriteRefusedError, toastLedgerWriteError } from 'hooks/useLedgerMutations';
import { useActivityStore } from 'store/activity-store';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import type { ExpenseModalEditInitialization, ExpenseModalSource } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { useExpenseModalOpenChange, useExpenseModalSubmit } from './hooks';

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

const originalSharingMode: SharingMode = { type: 'AUTO' };

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
            amount: 20,
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

const fetchSetActivity = vi.fn(() => Promise.resolve());
const fetchSetActivitySubevents = vi.fn(() => Promise.resolve());
const initialActivity = useActivityStore.getState();

// Signed in as the current user on its persisted client: the only place ledger writes run.
const signIn = (): void => {
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
    mountAsUserClient(currentUser.id);
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
    useActivityStore.setState({ fetchSetActivity, fetchSetActivitySubevents });
});

afterEach(() => {
    onlineManager.setOnline(true);
    useActivityStore.setState(initialActivity, true);
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
    signIn();
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
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
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
    signIn();
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
    expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
        parentActivityId: 'activity-1',
        category: undefined,
        force: true,
    });
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
    signIn();
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
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
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
// auth session version stays, the previous user's data and client go (spec 03 §1.5).
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
    expect(getAuthSessionVersion()).toBe(sessionVersion);
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
            signIn();
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
            expect(fetchSetActivity).not.toHaveBeenCalled();
        },
    );

    test('an edit answered then shows no toast and does not close the modal either', async () => {
        signIn();
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
        expect(fetchSetActivitySubevents).not.toHaveBeenCalled();
    });
});
