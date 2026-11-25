import {
    InfiniteQueryObserver,
    onlineManager,
    type QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { activityKeys, selfActivityPreviewsQueryOptions } from 'entities/activity';
import { dashboardKeys } from 'entities/dashboard';
import {
    capabilitiesQueryOptions,
    type ExpenseDraft,
    type ExpensePatch,
    ledgerKeys,
    ledgerOnlineMutationKeys,
    ledgerOutboxMutationKeys,
    type SettlementDraft,
} from 'entities/ledger';
import { usersKeys } from 'entities/users';
import {
    getAuthSessionVersion,
    invalidateAuthSession,
    isAuthSessionSwitchedSince,
} from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { ApiError } from 'shared/api/client';
import { createQueryClient } from 'shared/api/queryClient';
import { currencyCode, fromUnits } from 'shared/money';
import { clearUserData } from 'shared/offline/clearUserData';
import { OutboxLockTimeoutError } from 'shared/offline/outboxIo';
import {
    OutboxCreateSentError,
    OutboxLimitError,
    OutboxPersistError,
    pendingOutboxOps,
    resetOutbox,
} from 'shared/offline/outboxStore';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    LedgerWriteRefusedError,
    startUserLedgerOutbox,
    toastLedgerWriteError,
    useCreateExpense,
    useCreateSettlement,
    useDeleteLedgerEntry,
    useUpdateExpense,
} from './useLedgerMutations';

import 'fake-indexeddb/auto';
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

const expense: ExpenseDraft = {
    description: 'Dinner',
    amount: fromUnits(200_000n, currencyCode('USD')),
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

// Signed in as `user-1` on its persisted client (`ownClient`, or the test client), with the
// dashboard, the friends, the user's activity feed and the history of `activity-1` cached.
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
    client.setQueryData(selfFeedKey, { pages: [], pageParams: [] });
    client.setQueryData(historyKey, historyData);
    return client;
};

const selfFeedKey = activityKeys.self({ view: 'previews' });
const historyKey = activityKeys.children('activity-1');
const historyData = {
    pages: [{ parent: { kind: 'invalid', id: 'activity-1' }, items: [], nextCursor: null }],
    pageParams: [null],
};

const isStale = (client: QueryClient, queryKey: readonly unknown[]): boolean =>
    client.getQueryState(queryKey)?.isInvalidated === true;

// The user's activity feed (`activity.self`) was invalidated on this client.
const isFeedStale = (client: QueryClient): boolean => isStale(client, selfFeedKey);

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
});

afterEach(() => {
    onlineManager.setOnline(true);
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
            entry: { description: 'Lunch' },
        }),
    ).rejects.toEqual(refused);
    await expect(result.current.remove.deleteLedgerEntry({ entryId: 'entry-1' })).rejects.toEqual(
        refused,
    );
    expect(sent).toEqual([]);
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
    let first: Promise<unknown> = Promise.resolve();
    let repeated: Promise<unknown> = Promise.resolve();

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
    const client = signIn();
    const gate = deferred();
    const reload = deferred();
    const sent = serve(gate, 200, reload);

    // Two hook instances (the modal and another control) share the flag of the user's client.
    const { result } = renderHook(() => ({
        writer: useCreateExpense(),
        watcher: useCreateExpense(),
        other: useUpdateExpense(),
    }));
    let write: Promise<unknown> = Promise.resolve();

    expect(result.current.watcher.isPending).toBe(false);
    act(() => {
        write = result.current.writer.createExpense({
            expense: { ...expense, groupId: 'group-1' },
        });
    });
    await waitFor(() => {
        expect(result.current.watcher.isPending).toBe(true);
    });
    expect(result.current.other.isPending).toBe(false);

    gate.resolve();
    await waitFor(() => {
        expect(sent).toContain('GET /groups/group-1');
    });
    expect(isFeedStale(client)).toBe(true);
    expect(result.current.watcher.isPending).toBe(true);

    await act(async () => {
        reload.resolve();
        await write;
    });
    await waitFor(() => {
        expect(result.current.watcher.isPending).toBe(false);
    });
});

// The dashboard feed is on screen: a successful write settles only once that feed has refetched.
test('a successful write waits for the shown activity feed to reload: pending until it has', async () => {
    const client = signIn(createQueryClient());
    const feedGate = deferred();
    let feedReads = 0;

    serve();
    server.use(
        http.get('*/users/self/activity-previews', async () => {
            feedReads += 1;
            // The first read loads the feed; the reload after the write is held.
            if (feedReads > 1) {
                await feedGate.promise;
            }
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
    );
    client.removeQueries({ queryKey: selfFeedKey });
    const feed = new InfiniteQueryObserver(client, selfActivityPreviewsQueryOptions());
    const unsubscribe = feed.subscribe(() => undefined);
    const { result } = renderHook(() => useCreateExpense(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    });
    let isSettled = false;
    let write: Promise<unknown> = Promise.resolve();

    try {
        await waitFor(() => {
            expect(feed.getCurrentResult().isSuccess).toBe(true);
        });
        act(() => {
            write = result.current.createExpense({ expense }).then(() => {
                isSettled = true;
            });
        });
        await waitFor(() => {
            expect(feedReads).toBe(2);
        });
        // The feed's reload is held: the write still waits for it.
        expect(isSettled).toBe(false);
        expect(result.current.isPending).toBe(true);

        await act(async () => {
            feedGate.resolve();
            await write;
        });
        expect(isSettled).toBe(true);
        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });
    } finally {
        feedGate.resolve();
        unsubscribe();
        await client.cancelQueries();
        client.clear();
    }
});

test('after an expense between friends the dashboard, the friends balances and the feed reload', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useCreateExpense());

    await act(() => result.current.createExpense({ expense }));

    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(true);
    expect(isFeedStale(client)).toBe(true);
    expect(isStale(client, historyKey)).toBe(false);
    expect(sent).toEqual(['POST /ledger/entries']);
});

test('after a group expense the group card, its page and its feed are read again', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useUpdateExpense());

    await act(() =>
        result.current.updateExpense({
            entryId: 'entry-1',
            entry: { description: 'Lunch' },
            groupId: 'group-1',
        }),
    );

    expect(sent[0]).toBe('PATCH /ledger/entries/entry-1');
    expect(sent).toContain('GET /groups/group-1');
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(isFeedStale(client)).toBe(true);
});

test('a write made from the activity history marks that history (activity.children) stale on its client', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useDeleteLedgerEntry());

    await act(() =>
        result.current.deleteLedgerEntry({ entryId: 'entry-1', parentActivityId: 'activity-1' }),
    );

    expect(sent).toEqual(['DELETE /ledger/entries/entry-1']);
    expect(isStale(client, historyKey)).toBe(true);
    expect(isStale(client, activityKeys.children('activity-2'))).toBe(false);
});

const patch: ExpensePatch = { description: 'Lunch' };
const settlement: SettlementDraft = {
    fromUserId: 'user-1',
    toUserId: 'user-2',
    amount: fromUnits(125_000n, currencyCode('USD')),
    groupId: 'group-1',
};

// One write of each kind in a group, sent through its hook.
const useWrites = () => ({
    create: useCreateExpense(),
    update: useUpdateExpense(),
    remove: useDeleteLedgerEntry(),
    settle: useCreateSettlement(),
});

type Writes = ReturnType<typeof useWrites>;

const groupWrites: [string, string, (writes: Writes) => Promise<unknown>][] = [
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
    [
        'settlement',
        'POST /ledger/entries',
        writes => writes.settle.createSettlement({ settlement }),
    ],
];

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

// The tab's user client is dropped without a change of the auth session version: since #641 every
// production path that drops it also moves the version, so this keeps the hook's client guard
// (`isUserCacheClient`) tested on its own (defence in depth).
const dropUserClient = (): void => {
    const sessionVersion = getAuthSessionVersion();

    act(() => {
        void clearUserData('user-1', () => undefined);
    });
    expect(getAuthSessionVersion()).toBe(sessionVersion);
};

describe.each<[string, () => void]>([
    ['a sign-out', invalidateAuthSession],
    ['an account switch in another tab', switchAccountInAnotherTab],
    ['a drop of its user client alone', dropUserClient],
])('a write answered after %s', (_name, endSession) => {
    test.each(groupWrites)(
        'a %s is refused as an ended session and reloads nothing in the next session',
        async (_kind, request, send) => {
            const client = signIn();
            const selfFeedRefreshes = watchSelfFeedRefreshes(client);
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
            expect(selfFeedRefreshes()).toEqual([]);
        },
    );

    test("a failed write is refused as an ended session too: its error is not the next session's", async () => {
        const selfFeedRefreshes = watchSelfFeedRefreshes(signIn());
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
        expect(selfFeedRefreshes()).toEqual([]);
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
        await waitFor(() => {
            expect(isFeedStale(client)).toBe(true);
        });
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
    await waitFor(() => {
        expect(isFeedStale(client)).toBe(true);
    });
    await waitFor(() => {
        expect(result.current.isPending).toBe(false);
    });
    groupGate.resolve();
});

// The history is a query: its refetch keeps the events it shows (and the open delete dialog), so a
// failed write, which may have been applied, marks it stale too (spec 03 §6 row 6, 12c).
test('a failed write made from the activity history marks that history stale and keeps what it shows', async () => {
    const client = signIn();
    serve(undefined, 403);
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

    await waitFor(() => {
        expect(isFeedStale(client)).toBe(true);
    });
    await waitFor(() => {
        expect(isStale(client, historyKey)).toBe(true);
    });
    expect(client.getQueryData(historyKey)).toEqual(historyData);
});

// The app's own client: `offlineFirst` queries with the app retry, which pause while offline. The
// interceptor marks the network unusable before the write sees its error. A timed-out write may
// be committed: the shown activity feed is invalidated anyway, its reload waits for the reconnect,
// and the write neither waits for it nor stays pending.
test('a write cut off by a network drop rejects at once with its own error, and the shown feed reloads on the reconnect', async () => {
    const client = signIn(createQueryClient());
    const sent: string[] = [];
    const feedReads: string[] = [];
    const drop = ({ request }: { request: Request }): Response => {
        sent.push(request.method);
        onlineManager.setOnline(false);
        return HttpResponse.error();
    };

    server.use(
        http.post('*/ledger/entries', drop),
        // Offline the feed's request fails as it would without a network.
        http.get('*/users/self/activity-previews', () => {
            if (!onlineManager.isOnline()) {
                return HttpResponse.error();
            }
            feedReads.push('GET');
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
        http.get('*/groups/group-1/activity-previews', () => HttpResponse.error()),
        http.get('*/groups/group-1', () => HttpResponse.error()),
    );
    // The dashboard feed is on screen, loaded and fresh.
    client.removeQueries({ queryKey: selfFeedKey });
    const feed = new InfiniteQueryObserver(client, selfActivityPreviewsQueryOptions());
    const unsubscribe = feed.subscribe(() => undefined);
    const { result } = renderHook(() => useCreateExpense(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    });
    const groupExpense = { expense: { ...expense, groupId: 'group-1' } };
    let failure: unknown = null;

    try {
        await waitFor(() => {
            expect(feed.getCurrentResult().isSuccess).toBe(true);
        });
        expect(feedReads).toHaveLength(1);

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
        // Every view is marked stale for the reconnect; the feed's reload fails offline and, after
        // the retry delay (1 s), waits paused for it.
        expect(isStale(client, dashboardKeys.balances())).toBe(true);
        await waitFor(
            () => {
                expect(client.getQueryState(selfFeedKey)?.fetchStatus).toBe('paused');
            },
            { timeout: 3000 },
        );
        expect(isFeedStale(client)).toBe(true);
        expect(result.current.isPending).toBe(false);
        expect(feedReads).toHaveLength(1);
        // The next submit is refused as offline, not as a write that is still running.
        await expect(result.current.createExpense(groupExpense)).rejects.toEqual(
            new LedgerWriteRefusedError('offline'),
        );
        expect(sent).toEqual(['POST']);

        act(() => {
            onlineManager.setOnline(true);
        });
        await waitFor(() => {
            expect(feedReads).toHaveLength(2);
        });
        expect(sent).toEqual(['POST']);
    } finally {
        unsubscribe();
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
    expect(isFeedStale(client)).toBe(false);
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
    expect(isFeedStale(client)).toBe(true);
});

test('deleting a settlement between friends reloads the friends balances and no group', async () => {
    const client = signIn();
    const sent = serve();
    const { result } = renderHook(() => useDeleteLedgerEntry());

    await act(() => result.current.deleteLedgerEntry({ entryId: 'settlement-1' }));

    expect(sent).toEqual(['DELETE /ledger/entries/settlement-1']);
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(true);
    expect(isFeedStale(client)).toBe(true);
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

test('03 §2.8: an expense not saved on the device says so; a full outbox asks for the network', () => {
    toastLedgerWriteError(
        new OutboxPersistError(new Error('QuotaExceededError')),
        'Request failed',
    );
    toastLedgerWriteError(new OutboxLimitError(), 'Request failed');
    // 03-16a: a write-lock timeout is transient; offline saving stays on.
    toastLedgerWriteError(new OutboxPersistError(new OutboxLockTimeoutError()), 'Request failed');
    expect(vi.mocked(toast.error).mock.calls).toEqual([
        ['Could not save on the device — connect to the network'],
        ['Too many unsent operations — connect to the network'],
        ['Could not save, try again'],
    ]);
    expect(toast.success).not.toHaveBeenCalled();
});

test('03-16a part B: a changed repeat of a create being sent has its own toast', () => {
    toastLedgerWriteError(new OutboxCreateSentError(), 'Request failed');
    expect(vi.mocked(toast.error).mock.calls).toEqual([
        ['This expense is already being sent; edit it once it is saved'],
    ]);
});

test('a settlement is sent with its amount as a scale-4 literal and reloads the group, the dashboard and the feeds', async () => {
    const client = signIn();
    const sent = serve();
    const bodies: string[] = [];

    server.use(
        http.post('*/ledger/entries', async ({ request }) => {
            bodies.push(await request.text());
            return HttpResponse.json({ id: 'settlement-1' });
        }),
    );
    const { result } = renderHook(() => useCreateSettlement());

    await act(() => result.current.createSettlement({ settlement }));

    expect(bodies).toEqual([
        '{"type":"SETTLEMENT","groupId":"group-1","settlement":{"fromUserId":"user-1",' +
            '"toUserId":"user-2","amount":12.5000,"currency":"USD"}}',
    ]);
    expect(sent).toContain('GET /groups/group-1');
    expect(isStale(client, dashboardKeys.balances())).toBe(true);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(isFeedStale(client)).toBe(true);
});

test('a settlement while an expense is being created is refused as busy: one ledger create at a time', async () => {
    signIn();
    const gate = deferred();
    const sent = serve(gate);
    const { result } = renderHook(useWrites);
    let first: Promise<unknown> = Promise.resolve();

    act(() => {
        first = result.current.create.createExpense({ expense });
    });
    await waitFor(() => {
        expect(result.current.create.isPending).toBe(true);
    });
    await expect(result.current.settle.createSettlement({ settlement })).rejects.toEqual(
        new LedgerWriteRefusedError('busy'),
    );
    gate.resolve();
    await act(() => first);
    expect(sentWrites(sent)).toEqual(['POST /ledger/entries']);
});

describe('C1-10 two create paths', () => {
    afterEach(() => {
        resetOutbox();
        vi.unstubAllEnvs();
    });

    const mutationKeys = (client: QueryClient): unknown[] =>
        client
            .getMutationCache()
            .getAll()
            .map(mutation => mutation.options.mutationKey);

    test('without offline writes useCreateExpense creates a mutation with the online key', async () => {
        const client = signIn();
        const sent = serve();
        const { result } = renderHook(useCreateExpense);

        await expect(
            act(() => result.current.createExpense({ expense, clientEntryId: 'entry-form' })),
        ).resolves.toEqual({ queued: false });
        expect(mutationKeys(client)).toEqual([ledgerOnlineMutationKeys.createEntry]);
        expect(client.getMutationCache().getAll()[0]?.options).toMatchObject({
            networkMode: 'online',
            retry: false,
        });
        expect(sentWrites(sent)).toEqual(['POST /ledger/entries']);
    });

    test('with offline writes it queues the expense: offline too, one outbox mutation, no online one', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = signIn();

        await clear();
        await startUserLedgerOutbox(client, 'user-1');
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
        const sent = serve();

        onlineManager.setOnline(false);
        const { result } = renderHook(useCreateExpense);

        // 03-15b R1 L5: queued, not answered: the caller shows no success toast of its own.
        await expect(act(() => result.current.createExpense({ expense }))).resolves.toEqual({
            queued: true,
        });
        expect(mutationKeys(client)).toEqual([ledgerOutboxMutationKeys.createExpense]);
        expect(client.getMutationCache().getAll()[0]?.options).toMatchObject({
            networkMode: 'always',
            retry: false,
        });
        expect(sentWrites(sent)).toEqual([]);
        // §2.8: saved on the device (the append write landed), sent when the network is back.
        expect(pendingOutboxOps()).toHaveLength(1);
        expect(vi.mocked(toast.success).mock.calls).toEqual([
            ['Saved, we will send it when the network is back'],
        ]);
    });

    test('03-16a part B: queued while online, the toast says it is saved and being sent (no "created")', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = signIn();

        await clear();
        await startUserLedgerOutbox(client, 'user-1');
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
        serve();
        const { result } = renderHook(useCreateExpense);

        await expect(act(() => result.current.createExpense({ expense }))).resolves.toEqual({
            queued: true,
        });
        expect(vi.mocked(toast.success).mock.calls).toEqual([['Saved, sending…']]);
    });

    test('M2: a second submit in the same tick, while the first is being queued, is refused as busy: one op', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = signIn();

        await clear();
        await startUserLedgerOutbox(client, 'user-1');
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
        serve();
        onlineManager.setOnline(false);
        const { result } = renderHook(useCreateExpense);
        let first: Promise<unknown> = Promise.resolve();
        let second: Promise<unknown> = Promise.resolve();

        act(() => {
            first = result.current.createExpense({ expense });
            second = result.current.createExpense({ expense });
        });
        await expect(second).rejects.toEqual(new LedgerWriteRefusedError('busy'));
        await act(() => first);
        expect(mutationKeys(client)).toEqual([ledgerOutboxMutationKeys.createExpense]);
    });
});

describe('03-16a flag off = master', () => {
    test('an online edit and delete read no ledger entry and cache none; the create sends no client id', async () => {
        const client = signIn();
        const sent = serve();
        const bodies: unknown[] = [];

        server.use(
            http.get('*/ledger/entries/:id', ({ request }) => {
                sent.push(`GET ${new URL(request.url).pathname}`);
                return HttpResponse.json({ id: 'entry-1', type: 'EXPENSE', version: '1' });
            }),
            http.post('*/ledger/entries', async ({ request }) => {
                bodies.push(await request.json());
                return HttpResponse.json({ id: 'entry-2' });
            }),
        );
        const { result } = renderHook(useWrites);

        await act(() => result.current.update.updateExpense({ entryId: 'entry-1', entry: patch }));
        await act(() => result.current.remove.deleteLedgerEntry({ entryId: 'entry-1' }));
        await act(() =>
            result.current.create.createExpense({ expense, clientEntryId: 'entry-form' }),
        );

        expect(
            sent.filter(line => line.includes('/ledger/entries/entry-1') && line.startsWith('GET')),
        ).toEqual([]);
        expect(client.getQueryState(ledgerKeys.entry('entry-1'))).toBeUndefined();
        expect(bodies).toEqual([expect.not.objectContaining({ id: expect.anything() })]);
    });
});
