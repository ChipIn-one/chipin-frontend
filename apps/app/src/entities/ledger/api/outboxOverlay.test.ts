import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { clear, set } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import { stopOutboxDrain } from 'shared/offline/outboxDrain';
import {
    failedOutboxOps,
    notifyOutboxChange,
    pendingOutboxOps,
    resetOutbox,
    writeOutbox,
} from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import type { ExpenseDraft } from '../model/types';

import type { LedgerWriteEffects } from './mutations';
import { createExpenseViaOutbox, startLedgerOutbox, updateExpenseViaOutbox } from './outbox';
import { discardOutboxItem, retryOutboxItem, useOutboxOverlay } from './outboxOverlay';
import { capabilitiesQueryOptions, ledgerKeys } from './queries';

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

const queueEdit = (entryId: string, description: string): Promise<void> => {
    const queue = updateExpenseViaOutbox(client, { entryId, entry: { description } });

    if (!queue) {
        throw new Error('Expected the outbox path');
    }
    return queue();
};

const opIds = (): string[] => pendingOutboxOps().map(({ opId }) => opId);

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
        await act(() => discardOutboxItem(client, item));

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
        await act(() => discardOutboxItem(client, create));

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

describe('03-16a part B R1 M1/L1: a create is cancelled with its entry, all or nothing', () => {
    // A queued create of `entry-a` and one edit of it, offline; the create's item as rendered.
    const queueCreateAndEdit = async () => {
        await startOutbox();
        onlineManager.setOnline(false);
        const { result } = renderHook(useOutboxOverlay);

        await act(() => queueCreate('entry-a'));
        await act(() => queueEdit('entry-a', 'Dinner, edited'));
        await waitFor(() => {
            expect(result.current.pending).toHaveLength(2);
        });
        const create = result.current.pending.find(({ kind }) => kind === 'createExpense');

        if (!create) {
            throw new Error('Expected the pending create');
        }
        return { create, before: opIds() };
    };

    test('the create claimed (being sent) between render and confirm: nothing is cancelled', async () => {
        const { create, before } = await queueCreateAndEdit();

        // Another tab claims the create after this tab rendered its row.
        await writeOutbox(draft => {
            draft.sending = { opId: create.opId, session: 'another-tab' };
        });

        await expect(discardOutboxItem(client, create)).resolves.toBe(false);
        expect(opIds()).toEqual(before);

        // R2 N3: the claim ends (that tab let go of it) and the network is back: the create is
        // sent, then its edit with the version the create answered.
        const sent: string[] = [];

        server.use(
            http.post('*/ledger/entries', () => {
                sent.push('POST');
                return HttpResponse.json({ id: 'entry-a', type: 'EXPENSE', version: '1' });
            }),
            http.patch('*/ledger/entries/:id', ({ request, params }) => {
                sent.push(`PATCH ${String(params.id)} ${request.headers.get('If-Match')}`);
                return HttpResponse.json({ id: 'entry-a', type: 'EXPENSE', version: '2' });
            }),
        );
        await writeOutbox(draft => {
            draft.sending = null;
        });
        onlineManager.setOnline(true);
        await waitFor(() => {
            expect(sent).toEqual(['POST', 'PATCH entry-a "1"']);
        });
        await waitFor(() => {
            expect(opIds()).toEqual([]);
        });
    });

    test('the create already sent and removed before confirm: its edit is kept', async () => {
        const { create, before } = await queueCreateAndEdit();

        await writeOutbox(draft => {
            draft.ops = draft.ops.filter(({ opId }) => opId !== create.opId);
        });

        await expect(discardOutboxItem(client, create)).resolves.toBe(false);
        expect(opIds()).toEqual(before.filter(opId => opId !== create.opId));
    });

    test('an edit appended after the row was rendered is cancelled with the create', async () => {
        await startOutbox();
        onlineManager.setOnline(false);
        const { result } = renderHook(useOutboxOverlay);

        await act(() => queueCreate('entry-a'));
        await waitFor(() => {
            expect(result.current.pending).toHaveLength(1);
        });
        const [create] = result.current.pending;

        if (!create) {
            throw new Error('Expected the pending create');
        }
        expect(create.relatedOpIds).toEqual([]);
        await act(() => queueEdit('entry-a', 'Dinner, edited'));

        await expect(act(() => discardOutboxItem(client, create))).resolves.toBe(true);
        expect(opIds()).toEqual([]);
        // R1 N4: no optimistic entry of a create that will not exist.
        expect(client.getQueryData(ledgerKeys.entry('entry-a'))).toBeUndefined();
    });
});

describe('03-16a part B R1 L2: unreadable and blocked', () => {
    test('an unreadable record counts toward the badge; an op behind a failed record is blocked', async () => {
        await set(
            outboxFailedKey('user-1'),
            persistCodec.stringify([
                failedRecord('op-create', 'entry-c', 'createExpense', 'validation'),
                { op: { entryId: 'entry-u' }, reason: 'validation', failedAt: 1 },
            ]),
        );
        await startOutbox();
        onlineManager.setOnline(false);
        client.setQueryData(ledgerKeys.entry('entry-c'), {
            id: 'entry-c',
            type: 'EXPENSE',
            version: '1',
            groupId: 'group-1',
            expense: null,
        });
        const { result } = renderHook(useOutboxOverlay);

        await act(() => queueEdit('entry-c', 'Taxi home'));

        await waitFor(() => {
            expect(result.current.pending).toHaveLength(1);
        });
        expect(result.current.unreadableCount).toBe(1);
        expect(result.current.count).toBe(3);
        expect(result.current.pending[0]?.status).toBe('blocked');
    });
});

test('03-16a part B R1 N4: a cancelled edit has its cached entry read again', async () => {
    await startOutbox();
    onlineManager.setOnline(false);
    client.setQueryData(ledgerKeys.entry('entry-e'), {
        id: 'entry-e',
        type: 'EXPENSE',
        version: '1',
        groupId: 'group-1',
        expense: null,
    });
    const { result } = renderHook(useOutboxOverlay);

    await act(() => queueEdit('entry-e', 'Edited'));
    await waitFor(() => {
        expect(result.current.pending).toHaveLength(1);
    });
    const [edit] = result.current.pending;

    if (!edit) {
        throw new Error('Expected the pending edit');
    }
    await expect(act(() => discardOutboxItem(client, edit))).resolves.toBe(true);
    expect(client.getQueryState(ledgerKeys.entry('entry-e'))?.isInvalidated).toBe(true);
});

// 03-16a part C (R1 L4, M2): the groups a group settle-up is refused for.
test('queuedGroupIds: the groups of pending and failed ops; not a personal op, not an unreadable record', async () => {
    const pendingOp = (seq: number, groupId: string | null) => ({
        ...failedRecord(`op-p${seq}`, `entry-p${seq}`, 'createExpense', 'validation').op,
        seq,
        groupId,
    });

    await set(
        outboxStateKey('user-1'),
        persistCodec.stringify({
            nextSeq: 10,
            ops: [pendingOp(3, 'group-pending'), pendingOp(4, null)],
            versions: {},
            cancelled: [],
            retryRequested: [],
            sending: null,
            conflictDrafts: {},
        }),
    );
    await set(
        outboxFailedKey('user-1'),
        persistCodec.stringify([
            {
                ...failedRecord('op-f', 'entry-f', 'createExpense', 'validation'),
                op: {
                    ...failedRecord('op-f', 'entry-f', 'createExpense', 'validation').op,
                    groupId: 'group-failed',
                },
            },
            // An op of a newer build that names a group: unreadable here.
            {
                op: { entryId: 'entry-u', groupId: 'group-unreadable' },
                reason: 'validation',
                failedAt: 1,
            },
        ]),
    );
    await startOutbox();
    onlineManager.setOnline(false);
    const { result } = renderHook(useOutboxOverlay);

    await waitFor(() => {
        expect(result.current.restore).toBe('ok');
    });
    expect(result.current.count).toBe(4);
    expect(result.current.unreadableCount).toBe(1);
    expect([...result.current.queuedGroupIds].sort()).toEqual(['group-failed', 'group-pending']);
});

test('03-16b conflict drafts: listed, counted with the ops (badge, limit), their group queued', async () => {
    await set(
        outboxStateKey('user-1'),
        persistCodec.stringify({
            nextSeq: 1,
            ops: [],
            versions: {},
            cancelled: [],
            retryRequested: [],
            sending: null,
            conflictDrafts: {
                'entry-d': {
                    entryId: 'entry-d',
                    groupId: 'group-draft',
                    parentActivityId: 'activity-d',
                    fields: { description: 'Mine', category: 'food' },
                    createdAt: 3,
                },
            },
        }),
    );
    await startOutbox();
    onlineManager.setOnline(false);
    const { result } = renderHook(useOutboxOverlay);

    await waitFor(() => {
        expect(result.current.restore).toBe('ok');
    });
    expect(result.current.conflictDrafts).toEqual([
        {
            entryId: 'entry-d',
            groupId: 'group-draft',
            parentActivityId: 'activity-d',
            description: 'Mine',
            createdAt: 3,
        },
    ]);
    expect([...result.current.conflictDraftEntryIds]).toEqual(['entry-d']);
    expect(result.current.count).toBe(1);
    expect([...result.current.queuedGroupIds]).toEqual(['group-draft']);
});
