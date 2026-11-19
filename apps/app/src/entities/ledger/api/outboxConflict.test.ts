// Spec 03 §8 outbox, the rows of PR 03-16b (§2.6, D28): a 409 `LEDGER.VERSION_CONFLICT` keeps the
// user's changes as a conflict draft. The persisted queue (IndexedDB through `fake-indexeddb`), a
// "reload" is a new client of the same user. One tab (no Web Locks, as in `outboxPersist.test.ts`).
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createQueryClient } from 'shared/api/queryClient';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import { outboxGate } from 'shared/offline/outboxGate';
import { resetStoragePersistRequest } from 'shared/offline/outboxRegistry';
import {
    dropConflictDraft,
    failedOutboxOps,
    isOutboxFull,
    OUTBOX_LIMIT,
    outboxConflictDraft,
    outboxEntryIds,
    pendingOutboxOps,
    readOutboxRecordCount,
    resetOutbox,
    retryRequestedOps,
} from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    discardConflictDraft,
    type LedgerConflictNotice,
    onLedgerConflictNotice,
} from './conflictDrafts';
import type { LedgerWriteEffects } from './mutations';
import { deleteExpenseViaOutbox, startLedgerOutbox, updateExpenseViaOutbox } from './outbox';
import { type FailedOutboxItem, retryOutboxItem } from './outboxOverlay';
import { capabilitiesQueryOptions, ledgerEntryQueryOptions, ledgerKeys } from './queries';

import 'fake-indexeddb/auto';

const auth = vi.hoisted(() => ({ session: 'user-1' }));

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    getAccessTokenUserId: () => auth.session,
}));

const idb = await vi.importActual<typeof import('idb-keyval')>('idb-keyval');

const USER = 'user-1';
const OUTBOX_KEY = outboxStateKey(USER);
const FAILED_KEY = outboxFailedKey(USER);

const server = setupMswServer();

const effects: LedgerWriteEffects = {
    onEntryWritten: vi.fn(() => Promise.resolve()),
    onWriteFailed: vi.fn(() => Promise.resolve()),
};

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const readStored = (key: string): Promise<unknown> =>
    idb
        .get<unknown>(key)
        .then(text => (typeof text === 'string' ? persistCodec.parse(text) : text));

// An op as it is stored in the key.
const storedOp = (seq: number, entryId: string, fields: Record<string, unknown> = {}) => ({
    opId: `op-${seq}`,
    seq,
    owner: USER,
    entryKind: 'expense',
    createdAt: Date.now(),
    schema: 1,
    kind: 'updateExpense',
    entryId,
    groupId: 'group-1',
    parentActivityId: `activity-${entryId}`,
    baseVersion: 'v1',
    patch: { description: 'mine' },
    ...fields,
});

const storeOutbox = (ops: unknown[], fields: Record<string, unknown> = {}): Promise<void> =>
    idb.set(
        OUTBOX_KEY,
        persistCodec.stringify({
            nextSeq: ops.length + 1,
            ops,
            versions: {},
            cancelled: [],
            retryRequested: [],
            sending: null,
            conflictDrafts: {},
            ...fields,
        }),
    );

const storeFailed = (records: unknown[]): Promise<void> =>
    idb.set(FAILED_KEY, persistCodec.stringify(records));

const draftOf = (entryId: string, fields: Record<string, unknown>, createdAt = 5) => ({
    entryId,
    groupId: 'group-1',
    parentActivityId: `activity-${entryId}`,
    fields,
    createdAt,
});

// The server's entry X after another member changed it.
const current = (entryId: string, version = 'v50', updatedAt = 100) => ({
    id: entryId,
    type: 'EXPENSE',
    version,
    updatedAt,
    groupId: 'group-1',
});

interface Served {
    /** `<METHOD> <entry id> If-Match <value>`, in order. */
    requests: string[];
}

/**
 * The ledger: PATCH/DELETE of an entry in `conflicting` answers 409 with its `current`, any other
 * answers 200/204; GET answers `reads[id]` (404 when absent); POST creates.
 */
const serveLedger = (
    conflicting: ReadonlySet<string>,
    reads: Record<string, unknown> = {},
): Served => {
    const served: Served = { requests: [] };
    const conflict = (id: string) =>
        HttpResponse.json(
            { code: 'LEDGER.VERSION_CONFLICT', current: current(id) },
            { status: 409 },
        );

    server.use(
        http.patch('*/ledger/entries/:id', ({ request, params }) => {
            const id = String(params.id);

            served.requests.push(`PATCH ${id} If-Match ${request.headers.get('If-Match')}`);
            return conflicting.has(id)
                ? conflict(id)
                : HttpResponse.json(current(id, 'v-new', 200));
        }),
        http.delete('*/ledger/entries/:id', ({ request, params }) => {
            const id = String(params.id);

            served.requests.push(`DELETE ${id} If-Match ${request.headers.get('If-Match')}`);
            return conflicting.has(id) ? conflict(id) : new HttpResponse(null, { status: 204 });
        }),
        http.get('*/ledger/entries/:id', ({ params }) => {
            const id = String(params.id);

            served.requests.push(`GET ${id}`);
            const entry = reads[id];

            return entry === undefined
                ? HttpResponse.json({ code: 'LEDGER.ENTRY_NOT_FOUND' }, { status: 404 })
                : HttpResponse.json(entry);
        }),
        http.post('*/ledger/entries', async ({ request }) => {
            const body: unknown = await request.json();
            const id =
                typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '?';

            served.requests.push(`POST ${id}`);
            return HttpResponse.json({ id, type: 'EXPENSE', version: '1' });
        }),
    );
    return served;
};

const newTab = async (): Promise<QueryClient> => {
    resetOutbox();
    await wait(0);
    const client = mountAsUserClient(USER, createQueryClient());

    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
    return client;
};

const openTab = (): Promise<QueryClient> =>
    newTab().then(client => startLedgerOutbox(client, USER, effects).then(() => client));

// entry cached at `version`, an expense the user may edit.
const cacheEntry = (client: QueryClient, entryId: string, version: string, updatedAt = 10) => {
    client.setQueryData(ledgerKeys.entry(entryId), {
        id: entryId,
        type: 'EXPENSE',
        version,
        updatedAt,
        groupId: 'group-1',
        expense: null,
    });
};

// `replacesConflictDraft`: saved from a form opened on the entry's draft.
const queueEdit = (
    client: QueryClient,
    entryId: string,
    description: string,
    replacesConflictDraft = false,
) =>
    updateExpenseViaOutbox(client, {
        entryId,
        entry: { description },
        groupId: 'group-1',
        parentActivityId: `activity-${entryId}`,
        replacesConflictDraft,
    })?.() ?? Promise.reject(new Error('the online path was chosen'));

const notices: LedgerConflictNotice[] = [];
let unsubscribe = (): void => undefined;

beforeEach(async () => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    auth.session = USER;
    resetStoragePersistRequest();
    notices.length = 0;
    unsubscribe = onLedgerConflictNotice(notice => notices.push(notice));
    vi.mocked(effects.onEntryWritten).mockClear();
    await clear();
});

afterEach(() => {
    unsubscribe();
    resetOutbox();
    onlineManager.setOnline(true);
    vi.unstubAllEnvs();
});

describe('03-16b Conflict keeps a draft (D28)', () => {
    test('409 → current in the cache, the views refreshed, a draft of the changed fields, the later edit folded with 0 requests, Y unaffected; reload keeps it; Save → one PATCH with If-Match current.version', async () => {
        const served = serveLedger(new Set(['entry-x']));
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        cacheEntry(client, 'entry-y', 'v7');
        await queueEdit(client, 'entry-x', 'Lunch');
        await updateExpenseViaOutbox(client, {
            entryId: 'entry-x',
            entry: { category: 'travel' },
            groupId: 'group-1',
            parentActivityId: 'activity-entry-x',
        })?.();
        await queueEdit(client, 'entry-y', 'Taxi');
        onlineManager.setOnline(true);

        await vi.waitFor(() => expect(pendingOutboxOps()).toEqual([]));
        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(served.requests).toEqual([
            'PATCH entry-x If-Match "v41"',
            'PATCH entry-y If-Match "v7"',
        ]);
        expect(client.getQueryData(ledgerKeys.entry('entry-x'))).toMatchObject({
            version: 'v50',
            updatedAt: 100,
        });
        expect(effects.onEntryWritten).toHaveBeenCalledWith(
            expect.objectContaining({ entryId: 'entry-x', groupId: 'group-1' }),
            client,
        );
        expect(notices).toEqual([
            { kind: 'changed', entryId: 'entry-x', parentActivityId: 'activity-entry-x' },
        ]);
        expect(outboxConflictDraft('entry-x')).toEqual({
            entryId: 'entry-x',
            groupId: 'group-1',
            parentActivityId: 'activity-entry-x',
            fields: { description: 'Lunch', category: 'travel' },
            createdAt: expect.any(Number),
        });
        expect(failedOutboxOps()).toEqual([]);
        expect(outboxGate.isBlocked('entry-x')).toBe(false);

        // Reload: the draft is in the outbox key.
        const reloaded = await openTab();

        expect(outboxConflictDraft('entry-x')).toMatchObject({
            fields: { description: 'Lunch', category: 'travel' },
        });
        // Save from the form: an ordinary edit based on the cached `current`, the draft gone in
        // the same append write.
        server.resetHandlers();
        const resent = serveLedger(new Set());

        cacheEntry(reloaded, 'entry-x', 'v50', 100);
        onlineManager.setOnline(false);
        await queueEdit(reloaded, 'entry-x', 'Lunch', true);
        expect(outboxConflictDraft('entry-x')).toBeNull();
        const stored = await readStored(OUTBOX_KEY);

        expect(stored).toMatchObject({ conflictDrafts: {} });
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(resent.requests).toEqual(['PATCH entry-x If-Match "v50"']));
    });

    test('"Discard my changes" → no request, the draft is gone (in the key too)', async () => {
        const served = serveLedger(new Set());

        await storeOutbox([], {
            conflictDrafts: { 'entry-x': draftOf('entry-x', { description: 'L' }) },
        });
        await openTab();

        expect(outboxConflictDraft('entry-x')).not.toBeNull();
        await expect(discardConflictDraft('entry-x')).resolves.toBe(true);
        await expect(discardConflictDraft('entry-x')).resolves.toBe(false);
        expect(outboxConflictDraft('entry-x')).toBeNull();
        expect(await readStored(OUTBOX_KEY)).toMatchObject({ conflictDrafts: {} });
        await wait(20);
        expect(served.requests).toEqual([]);
    });

    test('Delete conflict → offline:conflictNotDeleted, cache = current, no draft, no further request', async () => {
        const served = serveLedger(new Set(['entry-x']));
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        await queueEdit(client, 'entry-x', 'Lunch');
        // A run that ends with a delete: the delete conflict drops everything.
        await deleteExpenseViaOutbox(client, {
            entryId: 'entry-x',
            groupId: 'group-1',
            parentActivityId: 'activity-entry-x',
        })?.();
        onlineManager.setOnline(true);

        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(notices[0]).toMatchObject({ kind: 'notDeleted', entryId: 'entry-x' });
        expect(served.requests).toEqual(['PATCH entry-x If-Match "v41"']);
        expect(client.getQueryData(ledgerKeys.entry('entry-x'))).toMatchObject({
            version: 'v50',
        });
        expect(outboxConflictDraft('entry-x')).toBeNull();
        expect(pendingOutboxOps()).toEqual([]);
        await wait(50);
        expect(served.requests).toHaveLength(1);
    });

    test('stale guard: a current older than the cached entry (by updatedAt) does not overwrite it', async () => {
        serveLedger(new Set(['entry-x']));
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        await queueEdit(client, 'entry-x', 'Lunch');
        // A read answered meanwhile with a newer entry than the 409 will carry (updatedAt 100).
        cacheEntry(client, 'entry-x', 'v60', 300);
        onlineManager.setOnline(true);

        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(client.getQueryData(ledgerKeys.entry('entry-x'))).toMatchObject({
            version: 'v60',
            updatedAt: 300,
        });
    });
});

describe('03-16b R1 M1: only a Save from a form opened on the draft replaces it', () => {
    test('a form opened before the conflict, saved after it (its append racing recordConflict): the draft is kept', async () => {
        serveLedger(new Set(['entry-x']));
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        await queueEdit(client, 'entry-x', 'Lunch');
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(outboxConflictDraft('entry-x')).not.toBeNull());

        // The edit of a form that was not opened on the draft lands after the conflict write.
        onlineManager.setOnline(false);
        await queueEdit(client, 'entry-x', 'Other');

        expect(pendingOutboxOps()).toEqual([
            expect.objectContaining({ kind: 'updateExpense', patch: { description: 'Other' } }),
        ]);
        expect(outboxConflictDraft('entry-x')).toMatchObject({ fields: { description: 'Lunch' } });
        expect(await readStored(OUTBOX_KEY)).toMatchObject({
            conflictDrafts: { 'entry-x': expect.objectContaining({ entryId: 'entry-x' }) },
        });
    });

    test('a queued delete drops the draft (it makes it moot)', async () => {
        serveLedger(new Set());
        await storeOutbox([], {
            conflictDrafts: { 'entry-x': draftOf('entry-x', { description: 'L' }) },
        });
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        await deleteExpenseViaOutbox(client, { entryId: 'entry-x' })?.();

        expect(outboxConflictDraft('entry-x')).toBeNull();
    });
});

describe('03-16b R1 L1, L3, L4, N4', () => {
    test('L1: an unreadable current drops the cached (optimistic) entry: no resend on the version that conflicted', async () => {
        server.use(
            http.patch('*/ledger/entries/:id', () =>
                HttpResponse.json(
                    { code: 'LEDGER.VERSION_CONFLICT', current: { id: 'entry-x' } },
                    { status: 409 },
                ),
            ),
        );
        const client = await openTab();

        onlineManager.setOnline(false);
        cacheEntry(client, 'entry-x', 'v41');
        await queueEdit(client, 'entry-x', 'Lunch');
        onlineManager.setOnline(true);

        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(client.getQueryData(ledgerKeys.entry('entry-x'))).toBeUndefined();
        expect(outboxConflictDraft('entry-x')).not.toBeNull();
    });

    test('L3: an old failed delete conflict dropped on restore says so (conflictNotDeleted)', async () => {
        serveLedger(new Set());
        await storeFailed([
            {
                op: storedOp(1, 'entry-y', { kind: 'deleteExpense', patch: undefined }),
                reason: 'conflict',
                failedAt: 8,
            },
        ]);
        await storeOutbox([], { nextSeq: 2 });
        await openTab();

        await vi.waitFor(() =>
            expect(notices).toEqual([
                { kind: 'notDeleted', entryId: 'entry-y', parentActivityId: 'activity-entry-y' },
            ]),
        );
    });

    test('L4: a drafted entry is read again on restore (outboxEntryIds)', async () => {
        const served = serveLedger(new Set(), { 'entry-x': current('entry-x') });

        await storeOutbox([], {
            conflictDrafts: { 'entry-x': draftOf('entry-x', { description: 'L' }) },
        });
        const client = await newTab();

        client.setQueryData(ledgerKeys.entry('entry-x'), current('entry-x'));
        await startLedgerOutbox(client, USER, effects);

        expect(outboxEntryIds().has('entry-x')).toBe(true);
        expect(client.getQueryState(ledgerKeys.entry('entry-x'))?.isInvalidated).toBe(true);
        expect(served.requests).toEqual([]);
    });

    test('N4: unknown fields of a stored draft are kept and written back', async () => {
        serveLedger(new Set());
        await storeOutbox([], {
            conflictDrafts: {
                'entry-x': { ...draftOf('entry-x', { description: 'L' }), future: 'kept' },
            },
        });
        await openTab();
        await dropConflictDraft('entry-other');

        expect(await readStored(OUTBOX_KEY)).toMatchObject({
            conflictDrafts: { 'entry-x': { future: 'kept' } },
        });
    });
});

describe('03-16b Conflict on a retried failed op', () => {
    test('422 → failed, entry blocked; Retry → 409 → gone from failed and retryRequested, unblocked, a draft; Retry twice → one request', async () => {
        const served = serveLedger(new Set(['entry-x']));

        await storeFailed([
            {
                op: storedOp(1, 'entry-x', { baseVersion: 'v41' }),
                reason: 'validation',
                failedAt: 5,
            },
        ]);
        await storeOutbox([], { nextSeq: 2 });
        await openTab();

        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        const [failed] = failedOutboxOps();
        const item: FailedOutboxItem = {
            opId: failed?.op.opId ?? '',
            entryId: 'entry-x',
            kind: 'updateExpense',
            description: 'mine',
            amount: null,
            share: null,
            relatedOpIds: [],
            canCancel: true,
            reason: 'validation',
            isRetrying: false,
            canRetry: true,
        };

        await Promise.all([retryOutboxItem(item), retryOutboxItem(item)]);
        await vi.waitFor(() => expect(notices).toHaveLength(1));
        await wait(50);

        expect(served.requests).toEqual(['PATCH entry-x If-Match "v41"']);
        expect(failedOutboxOps()).toEqual([]);
        expect(retryRequestedOps()).toEqual([]);
        expect(outboxGate.isBlocked('entry-x')).toBe(false);
        expect(outboxConflictDraft('entry-x')).toMatchObject({ fields: { description: 'mine' } });
    });
});

describe('03-16b Second conflict merges', () => {
    test('a draft { description } and a queued { amount } edit getting 409 → one draft with both fields, the first createdAt', async () => {
        serveLedger(new Set(['entry-x']));
        const amount = { __wireDecimal: '12.5000' };

        await storeOutbox(
            [storedOp(1, 'entry-x', { baseVersion: 'v41', patch: { amount, currency: 'USD' } })],
            { conflictDrafts: { 'entry-x': draftOf('entry-x', { description: 'first' }, 5) } },
        );
        await openTab();

        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(outboxConflictDraft('entry-x')).toEqual({
            entryId: 'entry-x',
            groupId: 'group-1',
            parentActivityId: 'activity-entry-x',
            fields: { description: 'first', amount: expect.anything(), currency: 'USD' },
            createdAt: 5,
        });
    });
});

describe('03-16b Unknown version', () => {
    test('an edit without a base version and no create queued: GET 200 → a draft, no PATCH', async () => {
        const served = serveLedger(new Set(), { 'entry-x': current('entry-x') });

        await storeOutbox([storedOp(1, 'entry-x', { baseVersion: null })]);
        await openTab();

        await vi.waitFor(() => expect(notices).toHaveLength(1));
        expect(served.requests).toEqual(['GET entry-x']);
        expect(outboxConflictDraft('entry-x')).toMatchObject({ fields: { description: 'mine' } });
    });

    test('GET 404 → failed deletedRemotely, the entry blocked, no PATCH, no draft', async () => {
        const served = serveLedger(new Set());

        await storeOutbox([storedOp(1, 'entry-x', { baseVersion: null })]);
        await openTab();

        await vi.waitFor(() =>
            expect(failedOutboxOps()).toEqual([
                expect.objectContaining({ reason: 'deletedRemotely' }),
            ]),
        );
        expect(served.requests).toEqual(['GET entry-x']);
        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        expect(outboxConflictDraft('entry-x')).toBeNull();
    });
});

describe('03-16b drafts in the key, the limit and the count', () => {
    test('a bad draft is dropped and the key stays readable; a 404 of the entry drops a draft once with "deleted"', async () => {
        serveLedger(new Set());
        await storeOutbox([], {
            conflictDrafts: {
                'entry-x': draftOf('entry-x', { description: 'kept' }),
                'entry-bad': { entryId: 'entry-bad', fields: 'not fields' },
                'entry-other': draftOf('entry-mismatch', {}),
            },
        });
        const client = await openTab();

        expect(outboxConflictDraft('entry-x')).not.toBeNull();
        expect(outboxConflictDraft('entry-bad')).toBeNull();
        expect(outboxConflictDraft('entry-other')).toBeNull();

        await client.fetchQuery(ledgerEntryQueryOptions('entry-x')).catch(() => undefined);
        await vi.waitFor(() => expect(outboxConflictDraft('entry-x')).toBeNull());
        await client
            .fetchQuery({ ...ledgerEntryQueryOptions('entry-x'), staleTime: 0 })
            .catch(() => undefined);
        await wait(20);
        expect(notices).toEqual([
            { kind: 'deleted', entryId: 'entry-x', parentActivityId: 'activity-entry-x' },
        ]);
    });

    test('§2.8, §1.5: drafts count towards the limit of 50 and the sign-out count', async () => {
        const drafts = Object.fromEntries(
            Array.from({ length: OUTBOX_LIMIT - 1 }, (_, index) => [
                `entry-${index}`,
                draftOf(`entry-${index}`, { description: 'd' }),
            ]),
        );

        await storeOutbox([], { conflictDrafts: drafts });
        await storeFailed([
            {
                op: storedOp(1, 'entry-f', { baseVersion: 'v1' }),
                reason: 'validation',
                failedAt: 5,
            },
        ]);
        onlineManager.setOnline(false);
        await openTab();

        expect(isOutboxFull()).toBe(true);
        await expect(readOutboxRecordCount(USER)).resolves.toBe(OUTBOX_LIMIT);
    });

    test('an old failed record with the interim reason conflict becomes a draft on restore (a delete is dropped)', async () => {
        serveLedger(new Set());
        await storeFailed([
            {
                op: storedOp(1, 'entry-x', { patch: { description: 'old' } }),
                reason: 'conflict',
                failedAt: 7,
            },
            {
                op: storedOp(2, 'entry-y', { kind: 'deleteExpense', patch: undefined }),
                reason: 'conflict',
                failedAt: 8,
            },
        ]);
        await storeOutbox([], { nextSeq: 3 });
        await openTab();

        await vi.waitFor(() => expect(failedOutboxOps()).toEqual([]));
        expect(outboxConflictDraft('entry-x')).toEqual({
            entryId: 'entry-x',
            groupId: 'group-1',
            parentActivityId: 'activity-entry-x',
            fields: { description: 'old' },
            createdAt: 7,
        });
        expect(outboxConflictDraft('entry-y')).toBeNull();
        expect(outboxGate.isBlocked('entry-x')).toBe(false);
    });
});
