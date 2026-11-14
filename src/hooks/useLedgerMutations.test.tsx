import { onlineManager, type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { CreateLedgerEntryParams } from 'api/chipin.types';
import { dashboardKeys } from 'entities/dashboard';
import { usersKeys } from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { ApiError } from 'shared/api/client';
import { createQueryClient } from 'shared/api/queryClient';
import { useActivityStore } from 'store/activity-store';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { legacyPreview } from 'test/activityFixtures';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    LedgerWriteRefusedError,
    toastLedgerWriteError,
    useCreateExpense,
    useDeleteLedgerEntry,
    useUpdateExpense,
} from './useLedgerMutations';

import 'i18n/index';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

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

const fetchSetActivity = vi.fn(() => Promise.resolve());
const fetchSetActivitySubevents = vi.fn(() => Promise.resolve());
const initialActivity = useActivityStore.getState();

const expense: CreateLedgerEntryParams = {
    description: 'Dinner',
    amount: 20,
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    currency: 'USD',
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

// Signed in as `user-1` on its persisted client (`ownClient`, or the test client), with the
// dashboard and the friends cached.
const signIn = (ownClient?: QueryClient): QueryClient => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    saveLocalUser({
        id: 'user-1',
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
    const client = mountAsUserClient('user-1', ownClient);

    client.setQueryData(dashboardKeys.balances(), []);
    client.setQueryData(usersKeys.known(), []);
    return client;
};

const isStale = (client: QueryClient, queryKey: readonly unknown[]): boolean =>
    client.getQueryState(queryKey)?.isInvalidated === true;

// The ledger and the group endpoints; `sent` lists `METHOD path` of every request, in order.
// `gate` holds the answer of a write, `groupGate` the answer of the group read.
const serve = (gate?: Deferred, status = 200, groupGate?: Deferred): string[] => {
    const sent: string[] = [];
    const record = (request: Request): void => {
        sent.push(`${request.method} ${new URL(request.url).pathname.replace(/^\/api/, '')}`);
    };
    const write = async ({ request }: { request: Request }): Promise<Response> => {
        record(request);
        await gate?.promise;
        if (status === 0) {
            return HttpResponse.error();
        }
        return status === 200
            ? HttpResponse.json({ id: 'entry-1' })
            : HttpResponse.json({ code: 'VALIDATION.INVALID' }, { status });
    };

    server.use(
        http.post('*/ledger/entries', write),
        http.patch('*/ledger/entries/:id', write),
        http.delete('*/ledger/entries/:id', write),
        http.get('*/groups/group-1/activity-previews', ({ request }) => {
            record(request);
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
        http.get('*/groups/group-1', async ({ request }) => {
            record(request);
            await groupGate?.promise;
            return HttpResponse.json(wireGroup('group-1'));
        }),
    );
    return sent;
};

const sentWrites = (sent: readonly string[]): string[] =>
    sent.filter(line => !line.startsWith('GET'));

beforeEach(() => {
    vi.clearAllMocks();
    useActivityStore.setState({ fetchSetActivity, fetchSetActivitySubevents });
});

afterEach(() => {
    onlineManager.setOnline(true);
    useActivityStore.setState(initialActivity, true);
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('a ledger write while signed out is refused before any request', async () => {
    const sent = serve();
    const { result } = renderHook(() => ({
        create: useCreateExpense(),
        update: useUpdateExpense(),
        remove: useDeleteLedgerEntry(),
    }));
    const refused = new LedgerWriteRefusedError('session');

    await expect(result.current.create.createExpense({ expense })).rejects.toEqual(refused);
    await expect(
        result.current.update.updateExpense({
            entryId: 'entry-1',
            entry: { type: 'EXPENSE', expense: { description: 'Lunch' } },
        }),
    ).rejects.toEqual(refused);
    await expect(result.current.remove.deleteLedgerEntry({ entryId: 'entry-1' })).rejects.toEqual(
        refused,
    );
    expect(sent).toEqual([]);
    expect(fetchSetActivity).not.toHaveBeenCalled();
});

test('a ledger write offline is refused: no request, and nothing is sent after the reconnect', async () => {
    signIn();
    const sent = serve();
    onlineManager.setOnline(false);
    const { result } = renderHook(() => ({
        create: useCreateExpense(),
        remove: useDeleteLedgerEntry(),
    }));
    const refused = new LedgerWriteRefusedError('offline');

    await expect(result.current.create.createExpense({ expense })).rejects.toEqual(refused);
    await expect(result.current.remove.deleteLedgerEntry({ entryId: 'entry-1' })).rejects.toEqual(
        refused,
    );
    expect(result.current.create.isPending).toBe(false);

    act(() => {
        onlineManager.setOnline(true);
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
    expect(result.current.create.isPending).toBe(false);
});

test('a double submit sends one request: the repeated write is refused as busy while the first runs', async () => {
    signIn();
    const gate = deferred();
    const sent = serve(gate);
    const { result } = renderHook(() => useCreateExpense());
    let first: Promise<void> = Promise.resolve();
    let repeated: Promise<void> = Promise.resolve();

    act(() => {
        first = result.current.createExpense({ expense });
        repeated = result.current.createExpense({ expense });
    });

    const refusal: unknown = await repeated.then(
        () => null,
        (error: unknown) => error,
    );

    expect(refusal).toEqual(new LedgerWriteRefusedError('busy'));
    await act(async () => {
        gate.resolve();
        await first;
    });
    expect(sentWrites(sent)).toEqual(['POST /ledger/entries']);
    // The first write has finished: the next submit is a new request.
    await act(() => result.current.createExpense({ expense }));
    expect(sentWrites(sent)).toHaveLength(2);
});

test('the saving flag comes from the mutation: on from the submit until the views have reloaded', async () => {
    signIn();
    const gate = deferred();
    const reload = deferred();

    serve(gate);
    fetchSetActivity.mockReturnValueOnce(reload.promise);
    // Two hook instances (the modal and another control) share the flag of the user's client.
    const { result } = renderHook(() => ({
        writer: useCreateExpense(),
        watcher: useCreateExpense(),
        other: useUpdateExpense(),
    }));
    let write: Promise<void> = Promise.resolve();

    expect(result.current.watcher.isPending).toBe(false);
    act(() => {
        write = result.current.writer.createExpense({ expense });
    });
    await waitFor(() => {
        expect(result.current.watcher.isPending).toBe(true);
    });
    expect(result.current.other.isPending).toBe(false);

    gate.resolve();
    await waitFor(() => {
        expect(fetchSetActivity).toHaveBeenCalledWith(true);
    });
    expect(result.current.watcher.isPending).toBe(true);

    await act(async () => {
        reload.resolve();
        await write;
    });
    await waitFor(() => {
        expect(result.current.watcher.isPending).toBe(false);
    });
});

test('after an expense between friends the dashboard, the friends balances and the feed reload', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useCreateExpense());

    await act(() => result.current.createExpense({ expense }));

    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(true);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
    expect(fetchSetActivitySubevents).not.toHaveBeenCalled();
    expect(sent).toEqual(['POST /ledger/entries']);
});

test('after a group expense the group card, its page and its feed are read again', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useUpdateExpense());

    await act(() =>
        result.current.updateExpense({
            entryId: 'entry-1',
            entry: { type: 'EXPENSE', expense: { description: 'Lunch' } },
            groupId: 'group-1',
        }),
    );

    expect(sent[0]).toBe('PATCH /ledger/entries/entry-1');
    expect(sent).toContain('GET /groups/group-1');
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('a write made from the activity history reloads that history in its open category', async () => {
    signIn();
    const sent = serve();

    useActivityStore.setState({
        subeventsParent: legacyPreview('activity-1').parent,
        subeventsCategory: 'expense',
    });
    const { result } = renderHook(() => useDeleteLedgerEntry());

    await act(() =>
        result.current.deleteLedgerEntry({ entryId: 'entry-1', parentActivityId: 'activity-1' }),
    );

    expect(sent).toEqual(['DELETE /ledger/entries/entry-1']);
    expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
        parentActivityId: 'activity-1',
        category: 'expense',
        force: true,
    });
});

const patch = { type: 'EXPENSE' as const, expense: { description: 'Lunch' } };

// One write of each kind in a group, sent through its hook.
const useWrites = () => ({
    create: useCreateExpense(),
    update: useUpdateExpense(),
    remove: useDeleteLedgerEntry(),
});

type Writes = ReturnType<typeof useWrites>;

const groupWrites: [string, string, (writes: Writes) => Promise<void>][] = [
    [
        'create',
        'POST /ledger/entries',
        writes => writes.create.createExpense({ expense: { ...expense, groupId: 'group-1' } }),
    ],
    [
        'update',
        'PATCH /ledger/entries/entry-1',
        writes =>
            writes.update.updateExpense({ entryId: 'entry-1', entry: patch, groupId: 'group-1' }),
    ],
    [
        'delete',
        'DELETE /ledger/entries/entry-1',
        writes => writes.remove.deleteLedgerEntry({ entryId: 'entry-1', groupId: 'group-1' }),
    ],
];

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

describe.each<[string, () => void]>([
    ['a sign-out', invalidateAuthSession],
    ['an account switch in another tab', switchAccountInAnotherTab],
])('a write answered after %s', (_name, endSession) => {
    test.each(groupWrites)(
        'a %s is refused as an ended session and reloads nothing in the next session',
        async (_kind, request, send) => {
            const client = signIn();
            const gate = deferred();
            const sent = serve(gate);
            const { result } = renderHook(useWrites);
            let write: Promise<unknown> = Promise.resolve();

            act(() => {
                write = send(result.current).then(
                    () => null,
                    (error: unknown) => error,
                );
            });
            await waitFor(() => {
                expect(sent).toEqual([request]);
            });
            endSession();
            gate.resolve();
            await act(async () => {
                expect(await write).toEqual(new LedgerWriteRefusedError('session'));
            });

            expect(sent).toEqual([request]);
            expect(isStale(client, dashboardKeys.balances())).toBe(false);
            expect(fetchSetActivity).not.toHaveBeenCalled();
            expect(fetchSetActivitySubevents).not.toHaveBeenCalled();
        },
    );

    test("a failed write is refused as an ended session too: its error is not the next session's", async () => {
        signIn();
        const gate = deferred();
        const sent = serve(gate, 400);
        const { result } = renderHook(useWrites);
        let write: Promise<unknown> = Promise.resolve();

        act(() => {
            write = result.current.remove.deleteLedgerEntry({ entryId: 'entry-1' }).then(
                () => null,
                (error: unknown) => error,
            );
        });
        await waitFor(() => {
            expect(sent).toHaveLength(1);
        });
        endSession();
        gate.resolve();
        await act(async () => {
            expect(await write).toEqual(new LedgerWriteRefusedError('session'));
        });
        expect(fetchSetActivity).not.toHaveBeenCalled();
    });
});

describe.each<[string, number]>([
    ['a 4xx answer', 400],
    ['a 5xx answer', 500],
    ['no response', 0],
])('a request with %s', (_name, status) => {
    test('rejects, reads its views again (spec 03 §2.1: on settle), and the next submit is sent', async () => {
        const client = signIn();
        const sent = serve(undefined, status);
        const { result } = renderHook(() => useCreateExpense());
        let failure: unknown = null;

        await act(async () => {
            failure = await result.current.createExpense({ expense }).then(
                () => null,
                (error: unknown) => error,
            );
        });

        expect(failure).toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(LedgerWriteRefusedError);
        expect(failure instanceof ApiError).toBe(status !== 0);
        expect(isStale(client, dashboardKeys.balances())).toBe(true);
        expect(isStale(client, usersKeys.known())).toBe(true);
        expect(fetchSetActivity).toHaveBeenCalledWith(true);
        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });
        await act(() => result.current.createExpense({ expense }).catch(() => undefined));
        expect(sentWrites(sent)).toHaveLength(2);
    });
});

test('a failed write rejects at once: its refresh starts but is not waited for', async () => {
    const client = signIn();
    const groupGate = deferred();
    const sent = serve(undefined, 409, groupGate);
    const { result } = renderHook(() => useUpdateExpense());
    let failure: unknown = null;

    await act(async () => {
        failure = await result.current
            .updateExpense({ entryId: 'entry-1', entry: patch, groupId: 'group-1' })
            .then(
                () => null,
                (error: unknown) => error,
            );
    });

    // Rejected while the group read is still unanswered.
    expect(failure).toBeInstanceOf(ApiError);
    await waitFor(() => {
        expect(sent).toContain('GET /groups/group-1');
    });
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
    await waitFor(() => {
        expect(result.current.isPending).toBe(false);
    });
    groupGate.resolve();
});

// A forced reload of the history shows the page skeletons, which closes the open delete dialog.
test('a failed write made from the activity history does not reload that history', async () => {
    signIn();
    serve(undefined, 403);
    useActivityStore.setState({ subeventsParent: legacyPreview('activity-1').parent });
    const { result } = renderHook(useWrites);

    await act(async () => {
        await expect(
            result.current.remove.deleteLedgerEntry({
                entryId: 'entry-1',
                parentActivityId: 'activity-1',
            }),
        ).rejects.toBeInstanceOf(ApiError);
        await expect(
            result.current.update.updateExpense({
                entryId: 'entry-1',
                entry: patch,
                parentActivityId: 'activity-1',
            }),
        ).rejects.toBeInstanceOf(ApiError);
    });

    expect(fetchSetActivity).toHaveBeenCalledTimes(2);
    expect(fetchSetActivitySubevents).not.toHaveBeenCalled();
});

// The app's own client: `offlineFirst` queries with the app retry, which pause while offline. The
// interceptor marks the network unusable before the write sees its error.
test('a write cut off by a network drop rejects at once with its own error and is not left pending', async () => {
    const client = signIn(createQueryClient());
    const sent: string[] = [];
    const drop = ({ request }: { request: Request }): Response => {
        sent.push(request.method);
        onlineManager.setOnline(false);
        return HttpResponse.error();
    };

    server.use(
        http.post('*/ledger/entries', drop),
        http.get('*/groups/group-1/activity-previews', () => HttpResponse.error()),
        http.get('*/groups/group-1', () => HttpResponse.error()),
    );
    const { result } = renderHook(() => useCreateExpense(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    });
    const groupExpense = { expense: { ...expense, groupId: 'group-1' } };
    let failure: unknown = null;

    try {
        await act(async () => {
            failure = await result.current.createExpense(groupExpense).then(
                () => null,
                (error: unknown) => error,
            );
        });

        expect(failure).toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(ApiError);
        expect(failure).not.toBeInstanceOf(LedgerWriteRefusedError);
        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });
        // The queries are marked stale for the reconnect; the legacy feed is not force-reloaded.
        expect(isStale(client, dashboardKeys.balances())).toBe(true);
        expect(fetchSetActivity).not.toHaveBeenCalled();
        // The next submit is refused as offline, not as a write that is still running.
        await expect(result.current.createExpense(groupExpense)).rejects.toEqual(
            new LedgerWriteRefusedError('offline'),
        );
        expect(sent).toEqual(['POST']);
    } finally {
        await client.cancelQueries();
        client.clear();
    }
});

test('a refused write was never sent and reloads nothing', async () => {
    const client = signIn();
    const sent = serve();

    onlineManager.setOnline(false);
    const { result } = renderHook(useWrites);

    for (const [, , send] of groupWrites) {
        await expect(send(result.current)).rejects.toEqual(new LedgerWriteRefusedError('offline'));
    }
    expect(sent).toEqual([]);
    expect(isStale(client, dashboardKeys.balances())).toBe(false);
    expect(fetchSetActivity).not.toHaveBeenCalled();
});

test('deleting a settlement in a group reads the group again, not the friends', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useDeleteLedgerEntry());

    await act(() =>
        result.current.deleteLedgerEntry({ entryId: 'settlement-1', groupId: 'group-1' }),
    );

    expect(sent[0]).toBe('DELETE /ledger/entries/settlement-1');
    expect(sent).toContain('GET /groups/group-1');
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('deleting a settlement between friends reloads the friends balances and no group', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useDeleteLedgerEntry());

    await act(() => result.current.deleteLedgerEntry({ entryId: 'settlement-1' }));

    expect(sent).toEqual(['DELETE /ledger/entries/settlement-1']);
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(true);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('the toast of a rejected write: offline is named, an ended session and a repeated submit show nothing, an API code is translated, anything else is the fallback', () => {
    toastLedgerWriteError(new LedgerWriteRefusedError('session'), 'Request failed');
    toastLedgerWriteError(new LedgerWriteRefusedError('busy'), 'Request failed');
    expect(toast.error).not.toHaveBeenCalled();

    toastLedgerWriteError(new LedgerWriteRefusedError('offline'), 'Request failed');
    toastLedgerWriteError(
        new ApiError({ status: 403, payload: { code: 'LEDGER.FORBIDDEN' }, cause: null }),
        'Request failed',
    );
    toastLedgerWriteError(new Error('Network Error'), 'Request failed');
    expect(vi.mocked(toast.error).mock.calls).toEqual([
        ['No internet connection'],
        ['You do not have permission to access this ledger entry'],
        ['Request failed'],
    ]);
});
