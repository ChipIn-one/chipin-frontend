import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { ledgerEntryKey } from 'shared/offline/outboxRegistry';
import {
    appendOutboxOp,
    failedOutboxOps,
    pendingOutboxOps,
    resetOutbox,
} from 'shared/offline/outboxStore';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import type { ExpenseDraft } from '../model/types';

import type { LedgerWriteEffects } from './mutations';
import { ledgerOnlineMutationKeys } from './mutations';
import {
    chooseLedgerWritePath,
    createExpenseViaOutbox,
    deleteExpenseViaOutbox,
    ledgerOutboxMutationKeys,
    startLedgerOutbox,
    updateExpenseViaOutbox,
} from './outbox';
import { capabilitiesQueryOptions } from './queries';

import 'fake-indexeddb/auto';

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    getAccessTokenUserId: () => 'user-1',
}));

const server = setupMswServer();

const effects: LedgerWriteEffects = {
    onEntryWritten: vi.fn(() => Promise.resolve()),
    onWriteFailed: vi.fn(() => Promise.resolve()),
};

const expense: ExpenseDraft = {
    groupId: 'group-1',
    description: 'Dinner',
    amount: fromUnits(200_000n, currencyCode('USD')),
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

interface SentRequest {
    line: string;
    headers: Record<string, string | null>;
    body: unknown;
}

// The ledger endpoints; every write answers the entry with the next version ("1", "2", …).
const serveLedger = (): SentRequest[] => {
    const sent: SentRequest[] = [];
    const record = async (request: Request, id: string): Promise<Response> => {
        const text = await request.text();

        sent.push({
            line: `${request.method} ${new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger')}`,
            headers: {
                'If-Match': request.headers.get('If-Match'),
                'X-Client-Op-Id': request.headers.get('X-Client-Op-Id'),
            },
            body: text ? JSON.parse(text) : null,
        });
        return request.method === 'DELETE'
            ? new HttpResponse(null, { status: 204 })
            : HttpResponse.json({ id, type: 'EXPENSE', version: String(sent.length) });
    };

    server.use(
        http.post('*/ledger/entries', ({ request }) => record(request, 'entry-new')),
        http.patch('*/ledger/entries/:id', ({ request, params }) =>
            record(request, String(params.id)),
        ),
        http.delete('*/ledger/entries/:id', ({ request, params }) =>
            record(request, String(params.id)),
        ),
    );
    return sent;
};

const withCapabilities = (client: QueryClient): void => {
    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
};

let client: QueryClient;

// With the flag on: the user's outbox starts as `clientFor` starts it (defaults, then restore).
const startOutbox = (): Promise<unknown> => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    return startLedgerOutbox(client, 'user-1', effects);
};

beforeEach(async () => {
    client = mountAsUserClient('user-1', getDefaultTestQueryClient());
    await clear();
});

afterEach(() => {
    onlineManager.setOnline(true);
    resetOutbox();
    vi.unstubAllEnvs();
});

describe('C1-10 two create paths', () => {
    test('flag off (the default): the online path, nothing of the outbox is read or created', () => {
        withCapabilities(client);
        const fetches = vi.spyOn(client, 'prefetchQuery');

        expect(createExpenseViaOutbox(client, { expense })).toBeNull();
        expect(chooseLedgerWritePath(client, { kind: 'create' })).toBe('online');
        expect(fetches).not.toHaveBeenCalled();
        expect(client.getMutationCache().getAll()).toEqual([]);
        expect(pendingOutboxOps()).toEqual([]);
    });

    test('flag on without the backend capabilities: the online path, the capabilities are fetched', () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const fetches = vi.spyOn(client, 'prefetchQuery').mockResolvedValue(undefined);

        expect(chooseLedgerWritePath(client, { kind: 'create' })).toBe('online');
        expect(fetches).toHaveBeenCalledTimes(1);
    });

    test('flag on: no mutation in the calling code, one op queued, the adopted mutation has the outbox key, no scope, retry false', async () => {
        await startOutbox();
        withCapabilities(client);
        const sent = serveLedger();
        const queue = createExpenseViaOutbox(client, { expense });

        expect(queue).not.toBeNull();
        expect(client.getMutationCache().getAll()).toEqual([]);
        await queue?.();

        const [mutation, ...others] = client.getMutationCache().getAll();

        expect(others).toEqual([]);
        expect(mutation?.options).toMatchObject({
            mutationKey: ledgerOutboxMutationKeys.createExpense,
            networkMode: 'always',
            retry: false,
        });
        expect(mutation?.options.scope).toBeUndefined();
        await vi.waitFor(() => expect(mutation?.state.status).toBe('success'));
        // §2.7: the outbox create carries the client entry id.
        const [create] = sent;

        expect(create?.line).toBe('POST /ledger/entries');
        expect(create?.body).toMatchObject({
            type: 'EXPENSE',
            id: expect.any(String),
            groupId: 'group-1',
            expense: { amount: 20, currency: 'USD' },
        });
        expect(effects.onEntryWritten).toHaveBeenCalledWith(
            { groupId: 'group-1', parentActivityId: undefined, entryId: expect.any(String) },
            client,
        );
        // The removal is its own IndexedDB write after the 2xx.
        await vi.waitFor(() => expect(pendingOutboxOps()).toEqual([]));
    });
});

test('03 §2.1: an edit and a delete go out with If-Match and X-Client-Op-Id, the second with the version of the first', async () => {
    await startOutbox();
    withCapabilities(client);
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: '41' });
    const sent = serveLedger();

    // Both queued before the first is sent (an IndexedDB append takes longer than a mocked answer;
    // the 2xx entry reaches the cache only with 03-16a).
    onlineManager.setOnline(false);
    await updateExpenseViaOutbox(client, {
        entryId: 'entry-x',
        entry: { description: 'Lunch' },
        groupId: 'group-1',
    })?.();
    await deleteExpenseViaOutbox(client, { entryId: 'entry-x', groupId: 'group-1' })?.();
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    const opIds = sent.map(request => request.headers['X-Client-Op-Id']);

    expect(sent).toEqual([
        {
            line: 'PATCH /ledger/entries/entry-x',
            headers: { 'If-Match': '"41"', 'X-Client-Op-Id': expect.any(String) },
            body: { type: 'EXPENSE', expense: { description: 'Lunch' } },
        },
        {
            line: 'DELETE /ledger/entries/entry-x',
            headers: { 'If-Match': '"1"', 'X-Client-Op-Id': expect.any(String) },
            body: null,
        },
    ]);
    expect(new Set(opIds).size).toBe(2);
});

test('03 §2.1/§2.5 (N3, N4): a delete with an unknown version whose entry is gone is a success; the open history is read again', async () => {
    await startOutbox();
    withCapabilities(client);
    // Cached without a version: the outbox asks the server for it.
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE' });
    const sent: string[] = [];

    server.use(
        http.get('*/ledger/entries/:id', () => {
            sent.push('GET');
            return HttpResponse.json({ code: 'LEDGER.NOT_FOUND' }, { status: 404 });
        }),
        http.delete('*/ledger/entries/:id', () => {
            sent.push('DELETE');
            return new HttpResponse(null, { status: 204 });
        }),
    );

    await deleteExpenseViaOutbox(client, {
        entryId: 'entry-x',
        groupId: 'group-1',
        parentActivityId: 'activity-1',
    })?.();
    await vi.waitFor(() =>
        expect(effects.onEntryWritten).toHaveBeenCalledWith(
            { groupId: 'group-1', parentActivityId: 'activity-1', entryId: 'entry-x' },
            client,
        ),
    );
    expect(sent).toEqual(['GET']);
    expect(failedOutboxOps()).toEqual([]);
    // The removal is its own IndexedDB write after the 2xx.
    await vi.waitFor(() => expect(pendingOutboxOps()).toEqual([]));
});

describe('C2-02 settlement guard', () => {
    test('deleting or editing a settlement takes the online path: 0 outbox ops', () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        withCapabilities(client);
        client.setQueryData(ledgerEntryKey('entry-s'), { type: 'SETTLEMENT', version: '3' });

        expect(chooseLedgerWritePath(client, { kind: 'delete', entryId: 'entry-s' })).toBe(
            'online',
        );
        expect(deleteExpenseViaOutbox(client, { entryId: 'entry-s' })).toBeNull();
        expect(updateExpenseViaOutbox(client, { entryId: 'entry-s', entry: {} })).toBeNull();
        expect(pendingOutboxOps()).toEqual([]);
        expect(ledgerOnlineMutationKeys.deleteEntry).toEqual(['ledger', 'online', 'deleteEntry']);
    });

    test('a queued op of an entry cached as a settlement is moved to failed on adoption and never sent', async () => {
        await startOutbox();
        withCapabilities(client);
        const sent = serveLedger();

        // As another tab would have written it before the entry was known to be a settlement.
        const foreign = await appendOutboxOp(seq => ({
            opId: 'op-settlement',
            seq,
            owner: 'user-1',
            entryKind: 'expense',
            createdAt: 1,
            schema: 1,
            kind: 'deleteExpense',
            entryId: 'entry-s',
            groupId: null,
            parentActivityId: null,
            baseVersion: '3',
        }));

        client.setQueryData(ledgerEntryKey('entry-s'), { type: 'SETTLEMENT', version: '3' });
        await createExpenseViaOutbox(client, { expense })?.();
        await vi.waitFor(() => expect(sent).toHaveLength(1));

        expect(sent.map(request => request.line)).toEqual(['POST /ledger/entries']);
        expect(failedOutboxOps()).toEqual([
            { op: foreign, reason: 'unreadable', failedAt: expect.any(Number) },
        ]);
    });
});
