import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { clear, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { outboxFailedKey } from 'shared/offline/constants';
import { stopOutboxDrain } from 'shared/offline/outboxDrain';
import {
    failedOutboxOps,
    notifyOutboxChange,
    pendingOutboxOps,
    resetOutbox,
} from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import type { ExpenseDraft } from '../model/types';

import type { LedgerWriteEffects } from './mutations';
import { createExpenseViaOutbox, startLedgerOutbox } from './outbox';
import { discardOutboxItem, retryOutboxItem, useOutboxOverlay } from './outboxOverlay';
import { capabilitiesQueryOptions } from './queries';

import 'fake-indexeddb/auto';

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    getAccessTokenUserId: () => 'user-1',
}));

const effects: LedgerWriteEffects = {
    onEntryWritten: vi.fn(() => Promise.resolve()),
    onWriteFailed: vi.fn(() => Promise.resolve()),
};

// 30.00 USD split by three: 10.00 each.
const expense: ExpenseDraft = {
    groupId: 'group-1',
    description: 'Dinner',
    amount: fromUnits(300_000n, currencyCode('USD')),
    date: 1_717_200_000,
    payerId: 'user-2',
    participantIds: ['user-1', 'user-2', 'user-3'],
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

const failedRecord = (opId: string, entryId: string, kind: string, reason: string) => ({
    op: {
        opId,
        seq: kind === 'createExpense' ? 1 : 2,
        owner: 'user-1',
        entryKind: 'expense',
        createdAt: Date.now(),
        schema: 1,
        kind,
        entryId,
        groupId: 'group-1',
        parentActivityId: null,
        ...(kind === 'createExpense'
            ? {
                  draft: {
                      description: 'Taxi',
                      amount: { __wireDecimal: '12.0000' },
                      currency: 'USD',
                      date: 1,
                      payerId: 'user-1',
                      participantIds: ['user-1', 'user-2'],
                      sharingMode: { type: 'AUTO' },
                  },
              }
            : { baseVersion: '1', patch: { description: 'Taxi home' } }),
    },
    reason,
    failedAt: Date.now(),
});

let client: QueryClient;

const startOutbox = (): Promise<unknown> => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
    return startLedgerOutbox(client, 'user-1', effects);
};

const queueCreate = (entryId: string): Promise<void> => {
    const queue = createExpenseViaOutbox(client, { expense, clientEntryId: entryId });

    if (!queue) {
        throw new Error('Expected the outbox path');
    }
    return queue();
};

beforeEach(async () => {
    client = mountAsUserClient('user-1', getDefaultTestQueryClient());
    await clear();
});

afterEach(async () => {
    await stopOutboxDrain();
    onlineManager.setOnline(true);
    resetOutbox();
    vi.unstubAllEnvs();
});

describe('03-16a part B flag off = master', () => {
    test('the overlay is the constant empty view and re-renders on no outbox change', () => {
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return useOutboxOverlay();
        });
        const first = result.current;

        act(() => {
            notifyOutboxChange();
        });
        expect(renders).toBe(1);
        expect(result.current).toBe(first);
        expect(first).toMatchObject({ restore: 'off', count: 0, pending: [], failed: [] });
    });
});

describe('03-16a part B overlay', () => {
    test('a queued create shows with its status, amount and "your share" (split, §3)', async () => {
        await startOutbox();
        onlineManager.setOnline(false);
        const { result } = renderHook(useOutboxOverlay);

        await act(() => queueCreate('entry-a'));

        await waitFor(() => {
            expect(result.current.count).toBe(1);
        });
        const [item] = result.current.pending;

        expect(item).toMatchObject({
            entryId: 'entry-a',
            kind: 'createExpense',
            description: 'Dinner',
            relatedOpIds: [],
            canCancel: true,
        });
        expect(item?.amount?.minor).toBe(300_000n);
        expect(item?.share?.minor).toBe(100_000n);
        expect(result.current.pendingCreates.has('entry-a')).toBe(true);
        expect(['queued', 'waiting-network']).toContain(item?.status);
    });

    test('a discard of a queued create removes it; the overlay re-renders', async () => {
        await startOutbox();
        onlineManager.setOnline(false);
        const { result } = renderHook(useOutboxOverlay);

        await act(() => queueCreate('entry-a'));
        await waitFor(() => {
            expect(result.current.pending).toHaveLength(1);
        });
        const [item] = result.current.pending;

        if (!item) {
            throw new Error('Expected a pending item');
        }
        await act(() => discardOutboxItem(item));

        await waitFor(() => {
            expect(result.current.count).toBe(0);
        });
        expect(pendingOutboxOps()).toEqual([]);
    });

    test('C2-15: a failed create lists the edit of its entry as related; its discard cancels both', async () => {
        await set(
            outboxFailedKey('user-1'),
            persistCodec.stringify([
                failedRecord('op-create', 'entry-c', 'createExpense', 'validation'),
                failedRecord('op-edit', 'entry-c', 'updateExpense', 'rejected'),
            ]),
        );
        await startOutbox();
        const { result } = renderHook(useOutboxOverlay);

        await waitFor(() => {
            expect(result.current.failed).toHaveLength(2);
        });
        const create = result.current.failed.find(({ opId }) => opId === 'op-create');

        expect(create).toMatchObject({
            reason: 'validation',
            relatedOpIds: ['op-edit'],
            canRetry: true,
            isRetrying: false,
            description: 'Taxi',
        });
        expect(create?.share?.minor).toBe(60_000n);
        if (!create) {
            throw new Error('Expected the failed create');
        }
        await act(() => discardOutboxItem(create));

        await waitFor(() => {
            expect(result.current.count).toBe(0);
        });
        expect(failedOutboxOps()).toEqual([]);
    });

    test('Retry of a failed op requests it once; the overlay shows it retrying', async () => {
        await set(
            outboxFailedKey('user-1'),
            persistCodec.stringify([
                failedRecord('op-edit', 'entry-c', 'updateExpense', 'forbidden'),
            ]),
        );
        onlineManager.setOnline(false);
        await startOutbox();
        const { result } = renderHook(useOutboxOverlay);

        await waitFor(() => {
            expect(result.current.failed).toHaveLength(1);
        });
        const [failed] = result.current.failed;

        if (!failed) {
            throw new Error('Expected the failed edit');
        }
        await expect(act(() => retryOutboxItem(failed))).resolves.toBe(true);
        await waitFor(() => {
            expect(result.current.failed[0]?.isRetrying ?? true).toBe(true);
        });
    });
});
