import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { CreateLedgerEntryParams } from 'api/chipin.types';
import { dashboardKeys } from 'entities/dashboard';
import { usersKeys } from 'entities/users';
import { invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { ApiError } from 'shared/api/client';
import { useActivityStore } from 'store/activity-store';
import { useAuthStore } from 'store/authStore';
import { legacyPreview } from 'test/activityFixtures';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    isRepeatedLedgerWrite,
    ledgerWriteErrorMessage,
    LedgerWriteRefusedError,
    useCreateExpense,
    useDeleteLedgerEntry,
    useUpdateExpense,
} from './useLedgerMutations';

import 'i18n/index';

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

// Signed in as `user-1` on its persisted client, with the dashboard and the friends cached.
const signIn = (): QueryClient => {
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
    const client = mountAsUserClient('user-1');

    client.setQueryData(dashboardKeys.balances(), []);
    client.setQueryData(usersKeys.known(), []);
    return client;
};

const isStale = (client: QueryClient, queryKey: readonly unknown[]): boolean =>
    client.getQueryState(queryKey)?.isInvalidated === true;

// The ledger and the group endpoints; `sent` lists `METHOD path` of every request, in order.
const serve = (gate?: Deferred, status = 200): string[] => {
    const sent: string[] = [];
    const record = (request: Request): void => {
        sent.push(`${request.method} ${new URL(request.url).pathname.replace(/^\/api/, '')}`);
    };
    const write = async ({ request }: { request: Request }): Promise<Response> => {
        record(request);
        await gate?.promise;
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
        http.get('*/groups/group-1', ({ request }) => {
            record(request);
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
    expect(isRepeatedLedgerWrite(refusal)).toBe(true);
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

test('a sign-out or an account switch during the request reloads nothing in the next user caches', async () => {
    const client = signIn();
    const gate = deferred();
    const sent = serve(gate);
    const { result } = renderHook(() => useCreateExpense());
    let write: Promise<void> = Promise.resolve();

    act(() => {
        write = result.current.createExpense({ expense: { ...expense, groupId: 'group-1' } });
    });
    await waitFor(() => {
        expect(sent).toEqual(['POST /ledger/entries']);
    });
    invalidateAuthSession();
    await act(async () => {
        gate.resolve();
        await write;
    });

    expect(sent).toEqual(['POST /ledger/entries']);
    expect(isStale(client, dashboardKeys.balances())).toBe(false);
    expect(isStale(client, usersKeys.known())).toBe(false);
    expect(fetchSetActivity).not.toHaveBeenCalled();
});

test('a failed request rejects with ApiError, reloads nothing, and the next submit is sent', async () => {
    const client = signIn();
    const sent = serve(undefined, 400);
    const { result } = renderHook(() => useCreateExpense());
    let failure: unknown = null;

    await act(async () => {
        failure = await result.current.createExpense({ expense }).then(
            () => null,
            (error: unknown) => error,
        );
    });

    expect(failure).toBeInstanceOf(ApiError);
    expect(ledgerWriteErrorMessage(failure, 'Request failed')).toBe(
        'Validation failed for the request',
    );
    expect(isStale(client, dashboardKeys.balances())).toBe(false);
    expect(fetchSetActivity).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
    await act(() => result.current.createExpense({ expense }).catch(() => undefined));
    expect(sentWrites(sent)).toHaveLength(2);
});

test('the error text: offline is named, an API code is translated, anything else is the fallback', () => {
    expect(ledgerWriteErrorMessage(new LedgerWriteRefusedError('offline'), 'Request failed')).toBe(
        'No internet connection',
    );
    expect(ledgerWriteErrorMessage(new LedgerWriteRefusedError('session'), 'Request failed')).toBe(
        'Request failed',
    );
    expect(ledgerWriteErrorMessage(new Error('Network Error'), 'Request failed')).toBe(
        'Request failed',
    );
});
