import { QueryClient } from '@tanstack/react-query';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    enqueueOutboxOp,
    ledgerEntryKey,
    OnlineOnlyError,
    type OutboxOpRequest,
} from './outboxRegistry';
import { type OutboxOpBase, pendingOutboxOps, readOutbox, resetOutbox } from './outboxStore';

import 'fake-indexeddb/auto';

type TestOp = OutboxOpBase & { baseVersion: string | null };

const enqueue = (client: QueryClient, request: Omit<OutboxOpRequest, 'owner'>): Promise<TestOp> =>
    enqueueOutboxOp(client, { ...request, owner: 'user-1' }, ({ base, baseVersion }) => ({
        ...base,
        baseVersion,
    }));

let client: QueryClient;

beforeEach(async () => {
    client = new QueryClient();
    await clear();
    await readOutbox('user-1');
});

afterEach(() => {
    resetOutbox();
});

describe('C2-02 the "expenses only" registry', () => {
    test.each(['updateExpense', 'deleteExpense'] as const)(
        '%s of a settlement is online only: no op is created',
        async kind => {
            client.setQueryData(ledgerEntryKey('entry-s'), { type: 'SETTLEMENT', version: '7' });

            await expect(enqueue(client, { kind, entryId: 'entry-s' })).rejects.toBeInstanceOf(
                OnlineOnlyError,
            );
            expect(pendingOutboxOps()).toEqual([]);
        },
    );

    test('C2-33: an edit of an entry that is not cached is online only', async () => {
        await expect(
            enqueue(client, { kind: 'updateExpense', entryId: 'entry-x' }),
        ).rejects.toBeInstanceOf(OnlineOnlyError);
        expect(pendingOutboxOps()).toEqual([]);
    });

    test('an edit of a cached expense is queued with its version as the base, a create needs no cache', async () => {
        client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: '42' });

        const created = await enqueue(client, { kind: 'createExpense', entryId: 'entry-y' });
        const edited = await enqueue(client, { kind: 'updateExpense', entryId: 'entry-x' });

        expect(created).toMatchObject({ seq: 1, owner: 'user-1', entryKind: 'expense', schema: 1 });
        expect(edited).toMatchObject({ seq: 2, kind: 'updateExpense', baseVersion: '42' });
        expect(pendingOutboxOps()).toEqual([created, edited]);
    });
});

test('C2-16: seq is assigned in the append, one higher for every op', async () => {
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: '1' });

    const ops = await Promise.all([
        enqueue(client, { kind: 'createExpense', entryId: 'entry-a' }),
        enqueue(client, { kind: 'updateExpense', entryId: 'entry-x' }),
        enqueue(client, { kind: 'deleteExpense', entryId: 'entry-x' }),
    ]);

    expect(ops.map(op => op.seq)).toEqual([1, 2, 3]);
    expect(new Set(ops.map(op => op.opId)).size).toBe(3);
});

test('03 §2.1: the base version is null while a create of the same entry is still queued', async () => {
    await enqueue(client, { kind: 'createExpense', entryId: 'entry-x' });
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: 'optimistic' });

    await expect(
        enqueue(client, { kind: 'updateExpense', entryId: 'entry-x' }),
    ).resolves.toMatchObject({ baseVersion: null });
});

test('03-15b R1 M3: the cached version is read when the append is written, not when it is called', async () => {
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: '41' });

    const edited = enqueue(client, { kind: 'updateExpense', entryId: 'entry-x' });

    // The entry's 2xx (or a refetch) wrote a fresher version before the append's write ran.
    client.setQueryData(ledgerEntryKey('entry-x'), { type: 'EXPENSE', version: '42' });
    await expect(edited).resolves.toMatchObject({ baseVersion: '42' });
});
