// Spec 03 §8 outbox, the rows of PR 03-15b: the persisted queue (IndexedDB through
// `fake-indexeddb`), its restore into a new client ("reload"), the restore guard, the failed key,
// the limits and the owner gate. One tab: no Web Locks, no `BroadcastChannel` (03-15c).
import * as Sentry from '@sentry/react';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { clear, del, get, set } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createQueryClient } from 'shared/api/queryClient';
import { currencyCode, fromUnits } from 'shared/money';
import { clearUserData } from 'shared/offline/clearUserData';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import { outboxGate } from 'shared/offline/outboxGate';
import { OutboxWriteStoppedError } from 'shared/offline/outboxIo';
import { enqueueOutboxOp, resetStoragePersistRequest } from 'shared/offline/outboxRegistry';
import { recheckOutboxOwner } from 'shared/offline/outboxRun';
import { FailedOpSchema } from 'shared/offline/outboxSchema';
import {
    appendOutboxOp,
    discardOps,
    failedOutboxOps,
    outboxEntryIds,
    OutboxLimitError,
    OutboxPersistError,
    outboxRestoreState,
    pendingOutboxOps,
    resetOutbox,
} from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import type { ExpenseDraft } from '../model/types';

import type { LedgerWriteEffects } from './mutations';
import {
    chooseLedgerWritePath,
    createExpenseViaOutbox,
    isOfflineWriteAvailable,
    ledgerOutboxMutationKeys,
    startLedgerOutbox,
} from './outbox';
import { capabilitiesQueryOptions } from './queries';

import 'fake-indexeddb/auto';

const auth = vi.hoisted(() => ({ session: 'user-1' }));

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    getAccessTokenUserId: () => auth.session,
}));
vi.mock('@sentry/react', async importOriginal => ({
    ...(await importOriginal<typeof import('@sentry/react')>()),
    captureMessage: vi.fn(),
}));
// The IndexedDB access log: every `set` and `del` of a key, in order.
const idbLog = vi.hoisted((): string[] => []);

vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return {
        ...actual,
        get: vi.fn(actual.get),
        set: vi.fn((key: IDBValidKey, value: unknown) => {
            idbLog.push(`set ${String(key)}`);
            return actual.set(key, value);
        }),
        del: vi.fn((key: IDBValidKey) => {
            idbLog.push(`del ${String(key)}`);
            return actual.del(key);
        }),
    };
});

const idb = await vi.importActual<typeof import('idb-keyval')>('idb-keyval');

const USER = 'user-1';
const OUTBOX_KEY = outboxStateKey(USER);
const FAILED_KEY = outboxFailedKey(USER);
const DAY = 24 * 60 * 60 * 1000;

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
    payerId: USER,
    participantIds: [USER, 'user-2'],
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

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

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// A create op as it is stored in the key.
const storedOp = (seq: number, entryId: string, fields: Record<string, unknown> = {}) => ({
    opId: `op-${seq}`,
    seq,
    owner: USER,
    entryKind: 'expense',
    createdAt: Date.now(),
    schema: 1,
    kind: 'createExpense',
    entryId,
    groupId: null,
    parentActivityId: null,
    draft: { description: `expense ${entryId}` },
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

// A write of the outbox key that takes a `sending` claim (§2.3).
const isClaimWrite = (value: unknown): boolean => {
    const stored: unknown = typeof value === 'string' ? persistCodec.parse(value) : null;

    return (
        typeof stored === 'object' &&
        stored !== null &&
        'sending' in stored &&
        stored.sending !== null
    );
};

const storeFailed = (records: unknown[]): Promise<void> =>
    idb.set(FAILED_KEY, persistCodec.stringify(records));

const readStored = (key: string): Promise<unknown> =>
    idb
        .get<unknown>(key)
        .then(text => (typeof text === 'string' ? persistCodec.parse(text) : text));

const storedOpIds = (): Promise<{ ops: string[]; failed: string[] }> =>
    Promise.all([readStored(OUTBOX_KEY), readStored(FAILED_KEY)]).then(([outbox, failed]) => {
        const opIdOf = (value: unknown): string =>
            typeof value === 'object' && value !== null && 'opId' in value
                ? String(value.opId)
                : '?';
        const ops =
            typeof outbox === 'object' && outbox !== null && 'ops' in outbox
                ? outbox.ops
                : undefined;

        return {
            ops: Array.isArray(ops) ? ops.map(opIdOf) : [],
            failed: Array.isArray(failed)
                ? failed.map((record: unknown) =>
                      typeof record === 'object' && record !== null && 'op' in record
                          ? opIdOf(record.op)
                          : '?',
                  )
                : [],
        };
    });

/** `POST /ledger/entries`: records the client entry id of every request; `fail` answers 422. */
const serveLedger = (fail: (entryId: string) => boolean = () => false): string[] => {
    const created: string[] = [];

    server.use(
        http.post('*/ledger/entries', async ({ request }) => {
            const body: unknown = await request.json();
            const id =
                typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '?';

            created.push(id);
            return fail(id)
                ? HttpResponse.json({ code: 'VALIDATION.INVALID' }, { status: 422 })
                : HttpResponse.json({ id, type: 'EXPENSE', version: '1' });
        }),
    );
    return created;
};

const withCapabilities = (client: QueryClient): void => {
    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
};

/**
 * A new tab ("reload"): this tab's memory is gone (its runs have resolved `stopped`, as a closed
 * tab's would never run again), and a new client is mounted for the user.
 */
const newTab = async (): Promise<QueryClient> => {
    resetOutbox();
    await wait(0);
    const client = mountAsUserClient(USER, createQueryClient());

    withCapabilities(client);
    return client;
};

const openTab = (): Promise<QueryClient> =>
    newTab().then(client => startLedgerOutbox(client, USER, effects).then(() => client));

const queueCreate = (client: QueryClient): Promise<void> =>
    createExpenseViaOutbox(client, { expense })?.() ??
    Promise.reject(new Error('the online path was chosen'));

beforeEach(async () => {
    // `restoreMocks` does not reset a `vi.fn` of a module mock: back to the real IndexedDB.
    vi.mocked(get).mockImplementation(idb.get);
    vi.mocked(set).mockImplementation((key, value) => {
        idbLog.push(`set ${String(key)}`);
        return idb.set(key, value);
    });
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    auth.session = USER;
    idbLog.length = 0;
    resetStoragePersistRequest();
    await clear();
});

afterEach(() => {
    resetOutbox();
    onlineManager.setOnline(true);
    vi.unstubAllEnvs();
});

describe('03-15b reload', () => {
    test('a new client sends the persisted ops once each, in seq order', async () => {
        const created = serveLedger();
        const first = await openTab();

        onlineManager.setOnline(false);
        await queueCreate(first);
        await queueCreate(first);
        await queueCreate(first);
        const queued = pendingOutboxOps();

        expect(queued.map(op => op.seq)).toEqual([1, 2, 3]);
        expect((await storedOpIds()).ops).toEqual(queued.map(op => op.opId));

        await openTab();
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(created).toHaveLength(3));
        await wait(100);
        expect(created).toEqual(queued.map(op => op.entryId));
        await vi.waitFor(async () => expect(await storedOpIds()).toEqual({ ops: [], failed: [] }));
    });

    test('a discard survives the reload; an op cancelled in the key is skipped by the restore', async () => {
        const created = serveLedger();
        const first = await openTab();

        onlineManager.setOnline(false);
        await queueCreate(first);
        await queueCreate(first);
        const [discarded, kept] = pendingOutboxOps();

        await expect(discardOps([discarded?.opId ?? ''])).resolves.toMatchObject({
            discarded: [discarded?.opId],
        });
        await openTab();
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(created).toEqual([kept?.entryId]));

        // A crash between a discard and its run's settle in another tab (03-15c): in both lists.
        await storeOutbox([storedOp(1, 'entry-a'), storedOp(2, 'entry-b')], {
            cancelled: ['op-1'],
        });
        await openTab();
        await vi.waitFor(() => expect(created).toEqual([kept?.entryId, 'entry-b']));
    });

    test('a repeated restore of the same client creates no second mutation (opId); defaults come first', async () => {
        await storeOutbox([storedOp(1, 'entry-a'), storedOp(2, 'entry-b')]);
        onlineManager.setOnline(false);
        const client = await openTab();

        await startLedgerOutbox(client, USER, effects);
        const mutations = client.getMutationCache().getAll();

        expect(mutations).toHaveLength(2);
        // Built from the registered defaults (§2.1: defaults before hydrate).
        mutations.forEach(mutation => {
            expect(mutation.options).toMatchObject({
                mutationKey: ledgerOutboxMutationKeys.createExpense,
                networkMode: 'always',
                retry: false,
                meta: { outbox: true },
            });
            expect(mutation.options.scope).toBeUndefined();
            expect(typeof mutation.options.mutationFn).toBe('function');
        });
    });
});

describe('03-15b the restore guard (§1.6, C3-02)', () => {
    test('a slow restore: a save meanwhile takes the online path, the key is not written; then the old ops are sent', async () => {
        const created = serveLedger();
        const hold = deferred();

        await storeOutbox([storedOp(1, 'entry-a')]);
        vi.mocked(get).mockImplementation(key =>
            key === OUTBOX_KEY ? hold.promise.then(() => idb.get(key)) : idb.get(key),
        );
        const client = await newTab();
        const restored = startLedgerOutbox(client, USER, effects);

        await wait(50);
        expect(outboxRestoreState(USER)).toBe('pending');
        expect(chooseLedgerWritePath(client, { kind: 'create' })).toBe('online');
        expect(createExpenseViaOutbox(client, { expense })).toBeNull();
        expect(idbLog).toEqual([]);

        hold.resolve();
        await expect(restored).resolves.toBe('ok');
        await vi.waitFor(() => expect(created).toEqual(['entry-a']));
        expect(isOfflineWriteAvailable(client)).toBe(true);
    });

    test('IDB throws on get: restore failed, the key unchanged, offline writes unavailable', async () => {
        await storeOutbox([storedOp(1, 'entry-a')]);
        const before = await idb.get<unknown>(OUTBOX_KEY);

        vi.mocked(get).mockImplementation(key =>
            key === OUTBOX_KEY
                ? Promise.reject(new DOMException('read failed', 'UnknownError'))
                : idb.get(key),
        );
        const client = await openTab();

        expect(outboxRestoreState(USER)).toBe('failed');
        expect(isOfflineWriteAvailable(client)).toBe(false);
        expect(createExpenseViaOutbox(client, { expense })).toBeNull();
        expect(client.getMutationCache().getAll()).toEqual([]);
        expect(idbLog).toEqual([]);
        expect(await idb.get<unknown>(OUTBOX_KEY)).toBe(before);
        expect(Sentry.captureMessage).toHaveBeenCalledWith('outbox.restore_failed', {
            level: 'warning',
            tags: { 'offline.error': 'UnknownError' },
        });
    });

    test('a key unreadable as a whole fails the restore and is kept', async () => {
        await idb.set(OUTBOX_KEY, persistCodec.stringify({ ops: 'not a list' }));
        const client = await openTab();

        expect(outboxRestoreState(USER)).toBe('failed');
        expect(isOfflineWriteAvailable(client)).toBe(false);
        expect(await readStored(OUTBOX_KEY)).toEqual({ ops: 'not a list' });
    });

    test('an invalid op moves to failed unreadable and the restore is still ok', async () => {
        const created = serveLedger();
        const garbage = { nonsense: true, entryId: 'entry-z' };

        await storeOutbox([
            garbage,
            storedOp(2, 'entry-b'),
            // A readable op whose payload is not a ledger op: unreadable on adoption.
            storedOp(3, 'entry-c', { draft: 'not a draft' }),
        ]);
        await openTab();

        expect(outboxRestoreState(USER)).toBe('ok');
        await vi.waitFor(() => expect(created).toEqual(['entry-b']));
        expect(failedOutboxOps()).toEqual([
            expect.objectContaining({
                op: expect.objectContaining({ opId: 'op-3' }),
                reason: 'unreadable',
            }),
        ]);
        expect(outboxEntryIds().has('entry-z')).toBe(true);
        expect(outboxGate.isBlocked('entry-c')).toBe(true);
        await vi.waitFor(async () =>
            expect(await readStored(FAILED_KEY)).toEqual([
                expect.objectContaining({ op: expect.objectContaining({ opId: 'op-3' }) }),
                { op: garbage, reason: 'unreadable', failedAt: expect.any(Number) },
            ]),
        );
    });

    test('N2: a failed record with the interim reason conflict stays readable and blocks its entry', async () => {
        const created = serveLedger();
        const conflict = { op: storedOp(1, 'entry-x'), reason: 'conflict', failedAt: 5 };

        expect(FailedOpSchema.parse(conflict)).toEqual(conflict);
        await storeFailed([conflict]);
        await storeOutbox([
            storedOp(2, 'entry-x', {
                kind: 'updateExpense',
                baseVersion: '1',
                patch: { description: 'later' },
                draft: undefined,
            }),
            storedOp(3, 'entry-y'),
        ]);
        await openTab();

        await vi.waitFor(() => expect(created).toEqual(['entry-y']));
        expect(failedOutboxOps()).toEqual([
            { op: expect.objectContaining({ opId: 'op-1' }), reason: 'conflict', failedAt: 5 },
        ]);
        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        expect(pendingOutboxOps().map(op => op.opId)).toEqual(['op-2']);
    });
});

describe('03-15b the failed key (§2.5, C3-05)', () => {
    test('a crash between the two writes of a move to failed: the op is in both, failed wins after the reload', async () => {
        const created = serveLedger(entryId => entryId === 'entry-x');
        let failOutboxWrites = true;

        // The claim write (03-15c1: persisted) lands; every later write of the outbox key fails.
        vi.mocked(set).mockImplementation((key, value) =>
            key === OUTBOX_KEY && failOutboxWrites && !isClaimWrite(value)
                ? Promise.reject(new DOMException('quota', 'QuotaExceededError'))
                : idb.set(key, value),
        );
        await storeOutbox([storedOp(1, 'entry-x'), storedOp(2, 'entry-y')]);
        const first = await openTab();

        // The failed key landed, the removal from `ops` did not: the op is in both, never in neither.
        await vi.waitFor(async () =>
            expect(await storedOpIds()).toEqual({ ops: ['op-1', 'op-2'], failed: ['op-1'] }),
        );
        // The write is retried while the op holds the turn: entry Y is not sent meanwhile.
        expect(created).toEqual(['entry-x']);

        // "Crash": this tab stops; its run gives up the write at its next attempt.
        resetOutbox();
        await vi.waitFor(
            () => expect(first.getMutationCache().getAll()[0]?.state.status).not.toBe('pending'),
            { timeout: 5_000 },
        );
        failOutboxWrites = false;
        await openTab();

        await vi.waitFor(() => expect(created).toEqual(['entry-x', 'entry-y']));
        expect(failedOutboxOps().map(({ op, reason }) => [op.opId, reason])).toEqual([
            ['op-1', 'validation'],
        ]);
        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        await vi.waitFor(async () =>
            expect(await storedOpIds()).toEqual({ ops: [], failed: ['op-1'] }),
        );
    });

    test('a rejected failed-key write: the op stays pending and keeps the turn until the write lands', async () => {
        const created = serveLedger(entryId => entryId === 'entry-x');
        let failFailedWrites = true;

        vi.mocked(set).mockImplementation((key, value) =>
            key === FAILED_KEY && failFailedWrites
                ? Promise.reject(new DOMException('quota', 'QuotaExceededError'))
                : idb.set(key, value),
        );
        await storeOutbox([storedOp(1, 'entry-x'), storedOp(2, 'entry-y')]);
        await openTab();

        await vi.waitFor(() => expect(created).toEqual(['entry-x']));
        await wait(300);
        expect(created).toEqual(['entry-x']);
        expect(await storedOpIds()).toEqual({ ops: ['op-1', 'op-2'], failed: [] });
        expect(pendingOutboxOps().map(op => op.opId)).toEqual(['op-1', 'op-2']);

        failFailedWrites = false;
        await vi.waitFor(() => expect(created).toEqual(['entry-x', 'entry-y']), {
            timeout: 5_000,
        });
        expect(failedOutboxOps().map(({ op }) => op.opId)).toEqual(['op-1']);
    });
});

describe('03-15b limits and storage (§2.8)', () => {
    test('quota: the append rejects, no success, the op does not exist and is never sent, offline writing is off', async () => {
        const created = serveLedger();
        const client = await openTab();

        vi.mocked(set).mockImplementation((key, value) =>
            key === OUTBOX_KEY
                ? Promise.reject(new DOMException('quota', 'QuotaExceededError'))
                : idb.set(key, value),
        );
        await expect(queueCreate(client)).rejects.toBeInstanceOf(OutboxPersistError);

        expect(pendingOutboxOps()).toEqual([]);
        expect(client.getMutationCache().getAll()).toEqual([]);
        expect(await idb.get(OUTBOX_KEY)).toBeUndefined();
        expect(isOfflineWriteAvailable(client)).toBe(false);
        expect(chooseLedgerWritePath(client, { kind: 'create' })).toBe('online');
        expect(Sentry.captureMessage).toHaveBeenCalledWith('outbox.persist_failed', {
            level: 'warning',
            tags: { 'offline.error': 'QuotaExceededError' },
        });
        await wait(100);
        expect(created).toEqual([]);
    });

    test('the 51st op (pending + failed) is refused: the online path, and a direct append is rejected', async () => {
        onlineManager.setOnline(false);
        await storeFailed([{ op: storedOp(50, 'entry-50'), reason: 'validation', failedAt: 1 }]);
        await storeOutbox(
            Array.from({ length: 49 }, (_, index) => storedOp(index + 1, `e-${index}`)),
        );
        const client = await openTab();

        expect(isOfflineWriteAvailable(client)).toBe(false);
        expect(createExpenseViaOutbox(client, { expense })).toBeNull();
        await expect(
            enqueueOutboxOp(
                client,
                { kind: 'createExpense', entryId: 'e-51', owner: USER },
                ({ base }) => base,
            ),
        ).rejects.toBeInstanceOf(OutboxLimitError);
        expect(pendingOutboxOps()).toHaveLength(49);
    });

    test('an op older than 14 days is failed stale, never sent; its entry is blocked', async () => {
        const created = serveLedger();

        await storeOutbox([
            storedOp(1, 'entry-old', { createdAt: Date.now() - 15 * DAY }),
            storedOp(2, 'entry-new'),
        ]);
        await openTab();

        await vi.waitFor(() => expect(created).toEqual(['entry-new']));
        expect(failedOutboxOps().map(({ op, reason }) => [op.opId, reason])).toEqual([
            ['op-1', 'stale'],
        ]);
        expect(outboxGate.isBlocked('entry-old')).toBe(true);
    });

    test('C3-10: the first saved op asks the browser once to keep the storage', async () => {
        const persist = vi.fn(() => Promise.resolve(true));
        const persisted = vi.fn(() => Promise.resolve(false));

        vi.stubGlobal(
            'navigator',
            Object.assign(Object.create(navigator), {
                storage: { persist, persisted },
            }),
        );
        try {
            const client = await openTab();

            onlineManager.setOnline(false);
            await queueCreate(client);
            await queueCreate(client);
            expect(persist).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('03-15b the owner gate (§2.3, C3-07)', () => {
    test("a token of another user: 0 outbox requests, the gate stays closed; the owner's token opens it", async () => {
        const created = serveLedger();

        auth.session = 'user-2';
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();

        await wait(150);
        expect(created).toEqual([]);
        expect(outboxGate.isClosed('auth')).toBe(true);

        recheckOutboxOwner('user-2');
        await wait(50);
        expect(created).toEqual([]);

        // The interceptor announces the owner's new token (`bootstrap/outboxWiring`).
        auth.session = USER;
        recheckOutboxOwner(USER);
        await vi.waitFor(() => expect(created).toEqual(['entry-a']));
    });
});

test('03 §1.5: clearUserData deletes both outbox keys after the write in flight; nothing is written after the del', async () => {
    const hold = deferred();
    const client = await openTab();

    onlineManager.setOnline(false);
    // The append write is held in flight; every write is logged when it reaches IndexedDB.
    vi.mocked(set).mockImplementation((key, value) =>
        (key === OUTBOX_KEY ? hold.promise : Promise.resolve()).then(() => {
            idbLog.push(`set ${String(key)}`);
            return idb.set(key, value);
        }),
    );
    const queued = queueCreate(client);

    await wait(20);
    const cleared = clearUserData(USER, () => undefined);

    hold.resolve();
    await cleared;
    await queued.catch(() => undefined);
    await wait(100);

    expect(await idb.get(OUTBOX_KEY)).toBeUndefined();
    expect(await idb.get(FAILED_KEY)).toBeUndefined();
    const lastDel = idbLog.lastIndexOf(`del ${OUTBOX_KEY}`);

    expect(lastDel).toBeGreaterThan(idbLog.indexOf(`set ${OUTBOX_KEY}`));
    expect(idbLog.indexOf(`set ${OUTBOX_KEY}`)).toBeGreaterThan(-1);
    expect(idbLog.slice(lastDel).filter(line => line.startsWith('set chipin:outbox'))).toEqual([]);
    expect(vi.mocked(del)).toHaveBeenCalledWith(FAILED_KEY);
    expect(outboxRestoreState(USER)).toBe('pending');
});

// The PATCH requests: `<entry id> If-Match <value>`.
const servePatches = (): string[] => {
    const patched: string[] = [];

    server.use(
        http.patch('*/ledger/entries/:id', ({ request, params }) => {
            patched.push(`${String(params.id)} If-Match ${request.headers.get('If-Match')}`);
            return HttpResponse.json({ id: String(params.id), type: 'EXPENSE', version: 'v-new' });
        }),
    );
    return patched;
};

const updateOp = (seq: number, entryId: string, baseVersion: string | null) =>
    storedOp(seq, entryId, {
        kind: 'updateExpense',
        baseVersion,
        patch: { description: 'changed' },
        draft: undefined,
    });

// Appends a create op directly (synchronously queued in the outbox IO order).
const appendCreate = (entryId: string) =>
    appendOutboxOp(seq => ({
        ...storedOp(seq, entryId),
        kind: 'createExpense' as const,
        entryKind: 'expense' as const,
        schema: 1 as const,
    }));

describe('03-15b R1', () => {
    test('M1: a discard whose write is in flight wins over the run reaching its claim: 0 requests, cancelled', async () => {
        const created = serveLedger();
        const hold = deferred();
        const client = await openTab();

        onlineManager.setOnline(false);
        await queueCreate(client);
        const [op] = pendingOutboxOps();
        const [mutation] = client.getMutationCache().getAll();

        vi.mocked(set).mockImplementation((key, value) =>
            key === OUTBOX_KEY ? hold.promise.then(() => idb.set(key, value)) : idb.set(key, value),
        );
        const discard = discardOps([op?.opId ?? '']);

        await wait(30);
        // The run takes its turn and waits for its claim behind the discard's write.
        onlineManager.setOnline(true);
        await wait(30);
        hold.resolve();

        await expect(discard).resolves.toEqual({ discarded: [op?.opId], refused: [] });
        await vi.waitFor(() => expect(mutation?.state.data).toEqual({ kind: 'cancelled' }));
        await wait(50);
        expect(created).toEqual([]);
    });

    test('L1: a failed record with a reason this build does not know still blocks its entry', async () => {
        const created = serveLedger();

        await storeFailed([{ op: storedOp(1, 'entry-x'), reason: 'future', failedAt: 1 }]);
        await storeOutbox([updateOp(2, 'entry-x', '1'), storedOp(3, 'entry-y')]);
        servePatches();
        await openTab();

        await vi.waitFor(() => expect(created).toEqual(['entry-y']));
        await wait(50);
        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        expect(pendingOutboxOps().map(op => op.opId)).toEqual(['op-2']);
        expect(await readStored(FAILED_KEY)).toEqual([
            expect.objectContaining({ reason: 'future' }),
        ]);
    });

    test('L2: a bad version, claim or retry list is dropped and reported, the restore stays ok, unknown keys are kept', async () => {
        const patched = servePatches();

        onlineManager.setOnline(false);
        await storeOutbox([updateOp(1, 'entry-y', '1'), updateOp(2, 'entry-x', '1')], {
            versions: { 'entry-y': 'v3', 'entry-x': 42 },
            sending: 'not a claim',
            retryRequested: 5,
            fromANewerBuild: { kept: true },
        });
        await openTab();

        expect(outboxRestoreState(USER)).toBe('ok');
        expect(Sentry.captureMessage).toHaveBeenCalledWith('outbox.invalid_field', {
            level: 'warning',
        });
        await vi.waitFor(async () =>
            expect(await readStored(OUTBOX_KEY)).toMatchObject({
                versions: { 'entry-y': 'v3' },
                sending: null,
                retryRequested: [],
                fromANewerBuild: { kept: true },
            }),
        );
        onlineManager.setOnline(true);
        // The dropped version falls back to the op's base version (or the GET of §2.1).
        await vi.waitFor(() =>
            expect(patched).toEqual(['entry-y If-Match "v3"', 'entry-x If-Match "1"']),
        );
    });

    test('N1: an unreadable op already moved to failed is not added twice', async () => {
        const bad = { opId: 'bad-1', entryId: 'entry-z' };

        await storeFailed([{ op: bad, reason: 'unreadable', failedAt: 1 }]);
        await storeOutbox([bad]);
        await openTab();

        await vi.waitFor(async () =>
            expect(await readStored(OUTBOX_KEY)).toMatchObject({ ops: [] }),
        );
        expect(await readStored(FAILED_KEY)).toEqual([
            { op: bad, reason: 'unreadable', failedAt: 1 },
        ]);
    });

    test('L3: before the restore is ok every outbox write is refused without IO, and the auth gate is closed', async () => {
        const hold = deferred();

        await storeOutbox([storedOp(1, 'entry-a')]);
        vi.mocked(get).mockImplementation(key =>
            key === OUTBOX_KEY ? hold.promise.then(() => idb.get(key)) : idb.get(key),
        );
        const client = await newTab();

        outboxGate.open('auth');
        const restored = startLedgerOutbox(client, USER, effects);

        expect(outboxGate.isClosed('auth')).toBe(true);
        const refusals = Promise.all([
            appendCreate('entry-b').then(
                () => 'written',
                (error: unknown) => error,
            ),
            discardOps(['op-1']).then(
                () => 'written',
                (error: unknown) => error,
            ),
        ]);
        const settled = await Promise.race([refusals, wait(50).then(() => 'pending')]);

        expect(settled).toEqual([
            expect.any(OutboxWriteStoppedError),
            expect.any(OutboxWriteStoppedError),
        ]);
        hold.resolve();
        await restored;
        expect(idbLog).toEqual([]);
        expect(pendingOutboxOps().map(op => op.opId)).toEqual(['op-1']);
    });

    test('L3: clearUserData refuses a queued write that has not started; nothing is written after the del', async () => {
        const hold = deferred();
        const client = await openTab();

        onlineManager.setOnline(false);
        vi.mocked(set).mockImplementation((key, value) =>
            (key === OUTBOX_KEY ? hold.promise : Promise.resolve()).then(() => {
                idbLog.push(`set ${String(key)}`);
                return idb.set(key, value);
            }),
        );
        const first = queueCreate(client);

        await wait(20);
        // Queued behind the first append, not started yet.
        const second = appendCreate('entry-second').then(
            () => 'written',
            (error: unknown) => error,
        );
        const cleared = clearUserData(USER, () => undefined);

        hold.resolve();
        await cleared;
        await first.catch(() => undefined);
        expect(await second).toBeInstanceOf(OutboxWriteStoppedError);
        await wait(50);

        expect(idbLog.filter(line => line === `set ${OUTBOX_KEY}`)).toHaveLength(1);
        expect(idbLog.indexOf(`del ${OUTBOX_KEY}`)).toBeGreaterThan(
            idbLog.indexOf(`set ${OUTBOX_KEY}`),
        );
        expect(await idb.get(OUTBOX_KEY)).toBeUndefined();
    });

    test('L3: clearUserData during the retry of a 2xx removal write: the retry writes nothing after the del', async () => {
        const created = serveLedger();
        let failRemoval = true;

        await storeOutbox([storedOp(1, 'entry-a')]);
        vi.mocked(set).mockImplementation((key, value) => {
            if (key === OUTBOX_KEY && failRemoval && !isClaimWrite(value)) {
                return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
            }
            idbLog.push(`set ${String(key)}`);
            return idb.set(key, value);
        });
        await openTab();
        await vi.waitFor(() => expect(created).toEqual(['entry-a']));
        await wait(50);

        await clearUserData(USER, () => undefined);
        failRemoval = false;
        // The removal retries after its backoff (1 s ± 20 %).
        await wait(1_500);

        const lastDel = idbLog.lastIndexOf(`del ${OUTBOX_KEY}`);

        expect(lastDel).toBeGreaterThan(-1);
        expect(idbLog.slice(lastDel).filter(line => line.startsWith('set chipin:outbox'))).toEqual(
            [],
        );
        expect(await idb.get(OUTBOX_KEY)).toBeUndefined();
    });
});
