// Spec 03 §8 outbox, the rows of PR 03-15c1: the write lock (`navigator.locks`, an in-memory
// manager shared by the "tabs" of a test), the persisted `sending` claim, the drain-session fence
// (M2), the queue read under the lock (N3) and the owner check under the claim's lock (N4). The
// tab holds the drain lock (03-15c2, `outboxDrain.test.ts`). IndexedDB through `fake-indexeddb`.
import * as Sentry from '@sentry/react';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { clear, get, set } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import type { LedgerWriteEffects } from 'entities/ledger/api/mutations';
import {
    chooseLedgerWritePath,
    type LedgerOutboxOp,
    startLedgerOutbox,
} from 'entities/ledger/api/outbox';
import { capabilitiesQueryOptions } from 'entities/ledger/api/queries';
import { getLocalUser, saveLocalUser } from 'helpers/localStorage';
import { createQueryClient } from 'shared/api/queryClient';
import { clearUserData } from 'shared/offline/clearUserData';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import { setOutboxPage } from 'shared/offline/outboxDrain';
import { outboxGate } from 'shared/offline/outboxGate';
import { outboxWriteLockName, OutboxWriteStoppedError } from 'shared/offline/outboxIo';
import {
    enqueueOutboxOp,
    ledgerEntryKey,
    resetStoragePersistRequest,
} from 'shared/offline/outboxRegistry';
import { runOutboxOp } from 'shared/offline/outboxRun';
import {
    appendOutboxOp,
    discardOps,
    getOutboxVersion,
    isOpCancelled,
    isOutboxPersistFailed,
    OutboxPersistError,
    outboxRestoreState,
    outboxStatus,
    pendingOutboxOps,
    resetOutbox,
    stopOutbox,
} from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { reportPersistFailed } from 'shared/offline/queryPersister';
import { onAccessTokenRefreshed } from 'store/authStore';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { setupMswServer } from 'test/mswServer';
import { fakeOutboxPage } from 'test/outboxPage';
import { mountAsUserClient } from 'test/userClient';
import { holdWebLock, removeWebLocks } from 'test/webLocks';

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
vi.mock('shared/offline/queryPersister', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/offline/queryPersister')>()),
    reportPersistFailed: vi.fn(),
}));
// The IndexedDB access log: every `set` of a key and every `del`, in order.
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
const OTHER = 'user-2';
const OUTBOX_KEY = outboxStateKey(USER);
const FAILED_KEY = outboxFailedKey(USER);
const WRITE_LOCK = outboxWriteLockName(USER);

const server = setupMswServer();

const effects: LedgerWriteEffects = {
    onEntryWritten: vi.fn(() => Promise.resolve()),
    onWriteFailed: vi.fn(() => Promise.resolve()),
};

const settings: SelfUser['settings'] = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'dark',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
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

const updateOp = (seq: number, entryId: string, baseVersion: string | null) =>
    storedOp(seq, entryId, {
        kind: 'updateExpense',
        baseVersion,
        patch: { description: 'changed' },
        draft: undefined,
    });

interface StoredOutbox {
    nextSeq: number;
    ops: { opId: string }[];
    versions: Record<string, string>;
    cancelled: string[];
    sending: { opId: string; session: string } | null;
    [field: string]: unknown;
}

const isStoredOutbox = (value: unknown): value is StoredOutbox =>
    typeof value === 'object' && value !== null && 'ops' in value && Array.isArray(value.ops);

const readOutboxKey = async (): Promise<StoredOutbox | null> => {
    const text = await idb.get<unknown>(OUTBOX_KEY);
    const stored: unknown = typeof text === 'string' ? persistCodec.parse(text) : null;

    return isStoredOutbox(stored) ? stored : null;
};

const writeOutboxKey = (outbox: StoredOutbox): Promise<void> =>
    idb.set(OUTBOX_KEY, persistCodec.stringify(outbox));

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

// A write of the outbox key that takes a `sending` claim.
const isClaimWrite = (value: unknown): boolean => {
    const stored: unknown = typeof value === 'string' ? persistCodec.parse(value) : null;

    return isStoredOutbox(stored) && stored.sending !== null;
};

/**
 * `POST /ledger/entries` and `PATCH /ledger/entries/:id`: each request is recorded; `answer` gives
 * the status of the n-th request (default 200) and `holds[n]`, when set, holds it.
 */
const serveLedger = (
    answer: (request: number) => number = () => 200,
    holds: Deferred[] = [],
): string[] => {
    const requests: string[] = [];
    const respond = async (id: string, label: string) => {
        const index = requests.length;

        requests.push(label);
        await holds[index]?.promise;
        const status = answer(index);

        return status === 200
            ? HttpResponse.json({ id, type: 'EXPENSE', version: `v-${index + 1}` })
            : HttpResponse.json({ code: 'TEST.ERROR' }, { status });
    };

    server.use(
        http.post('*/ledger/entries', async ({ request }) => {
            const body: unknown = await request.json();
            const id =
                typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '?';

            return respond(id, `POST ${id}`);
        }),
        http.patch('*/ledger/entries/:id', ({ request, params }) =>
            respond(
                String(params.id),
                `PATCH ${String(params.id)} If-Match ${request.headers.get('If-Match')}`,
            ),
        ),
    );
    return requests;
};

const withCapabilities = (client: QueryClient): void => {
    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
};

const newClient = (): QueryClient => {
    const client = mountAsUserClient(USER, createQueryClient());

    withCapabilities(client);
    return client;
};

/** A new tab: no memory of the previous one, a new client whose outbox is started. */
const openTab = async (): Promise<QueryClient> => {
    resetOutbox();
    await wait(0);
    const client = newClient();

    await startLedgerOutbox(client, USER, effects);
    return client;
};

const appendCreate = (entryId: string) =>
    appendOutboxOp(seq => ({
        ...storedOp(seq, entryId),
        kind: 'createExpense' as const,
        entryKind: 'expense' as const,
        schema: 1 as const,
    }));

const firstMutation = (client: QueryClient) => client.getMutationCache().getAll()[0];

beforeEach(async () => {
    vi.mocked(get).mockImplementation(idb.get);
    vi.mocked(set).mockImplementation((key, value) => {
        idbLog.push(`set ${String(key)}`);
        return idb.set(key, value);
    });
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    auth.session = USER;
    idbLog.length = 0;
    resetStoragePersistRequest();
    // Each test's tab is visible (the drain lock, 03-15c2).
    setOutboxPage(fakeOutboxPage().page);
    await clear();
});

afterEach(() => {
    resetOutbox();
    onlineManager.setOnline(true);
    vi.unstubAllEnvs();
});

describe('03-15c1 the write lock (§2.3)', () => {
    test('concurrent appends from two tabs keep both ops with distinct seq', async () => {
        // Two tabs: two instances of the outbox modules over one IndexedDB and one lock manager.
        const openStoreTab = async () => {
            vi.resetModules();
            const tab = await import('shared/offline/outboxStore');

            tab.startOutbox(USER);
            await tab.readOutbox(USER);
            return tab;
        };
        const tabA = await openStoreTab();
        const tabB = await openStoreTab();
        const append = (tab: typeof tabA, entryId: string) =>
            tab.appendOutboxOp(seq => ({
                ...storedOp(seq, entryId),
                opId: `op-${entryId}`,
                kind: 'createExpense' as const,
                entryKind: 'expense' as const,
                schema: 1 as const,
            }));

        await Promise.all([
            append(tabA, 'a1'),
            append(tabB, 'b1'),
            append(tabA, 'a2'),
            append(tabB, 'b2'),
        ]);

        const stored = await readOutboxKey();
        const seqs = (stored?.ops ?? []).map(op => ('seq' in op ? op.seq : null));

        expect(stored?.ops.map(op => op.opId).sort()).toEqual(['op-a1', 'op-a2', 'op-b1', 'op-b2']);
        expect(new Set(seqs).size).toBe(4);
        expect(stored?.nextSeq).toBe(5);
        tabA.resetOutbox();
        tabB.resetOutbox();
    });

    test('a write-lock timeout on append: a transient save error (the saveRetry toast), offline writing stays on', async () => {
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
            AbortSignal.abort(new DOMException('timed out', 'TimeoutError')),
        );
        await expect(appendCreate('entry-a')).rejects.toSatisfy(
            error => error instanceof OutboxPersistError && error.isTransient,
        );
        expect(isOutboxPersistFailed()).toBe(false);
        expect(Sentry.captureMessage).toHaveBeenCalledWith('outbox.write_lock_timeout', {
            level: 'warning',
        });
        release();
    });

    test('N3: an edit reads a queued create of its entry from the key under the lock, not from memory', async () => {
        const client = await openTab();

        onlineManager.setOnline(false);
        client.setQueryData(ledgerEntryKey('entry-a'), { type: 'EXPENSE', version: '7' });
        // Another tab appended a create of the entry: this tab has not read it.
        await storeOutbox([storedOp(1, 'entry-a')], { nextSeq: 2 });
        expect(pendingOutboxOps()).toEqual([]);

        const op = await enqueueOutboxOp(
            client,
            { kind: 'updateExpense', entryId: 'entry-a', owner: USER },
            ({ base, baseVersion }): LedgerOutboxOp => ({
                ...base,
                kind: 'updateExpense',
                groupId: null,
                parentActivityId: null,
                baseVersion,
                patch: { description: 'changed' },
            }),
        );

        expect(op.seq).toBe(2);
        expect('baseVersion' in op ? op.baseVersion : 'none').toBeNull();
    });
});

describe('03-15c1 the persisted claim (§2.3)', () => {
    test('the claim is cleared after a 5xx: a discard is then allowed, no second request', async () => {
        const requests = serveLedger(() => 503);

        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        await vi.waitFor(async () => expect((await readOutboxKey())?.sending).toBeNull());

        await expect(discardOps(['op-1'])).resolves.toEqual({
            discarded: ['op-1'],
            refused: [],
        });
        await wait(50);
        expect(requests).toHaveLength(1);
    });

    test('the claim fails once stopped: no claim written, no request, stopped', async () => {
        const requests = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        const client = await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        onlineManager.setOnline(true);
        await wait(30);
        stopOutbox();
        idbLog.length = 0;
        release();

        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toEqual({ kind: 'stopped' }),
        );
        await wait(30);
        expect(requests).toEqual([]);
        expect(idbLog).toEqual([]);
    });

    test('a claim write rejected is transient: the run claims again after a backoff and sends', async () => {
        const requests = serveLedger();
        let failClaims = 1;

        await storeOutbox([storedOp(1, 'entry-a')]);
        vi.mocked(set).mockImplementation((key, value) => {
            if (key === OUTBOX_KEY && isClaimWrite(value) && failClaims > 0) {
                failClaims -= 1;
                return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
            }
            return idb.set(key, value);
        });
        const client = await openTab();

        await wait(100);
        expect(requests).toEqual([]);
        expect(firstMutation(client)?.state.status).toBe('pending');
        // The claim is taken again after its backoff (1 s ± 20 %).
        await vi.waitFor(() => expect(requests).toEqual(['POST entry-a']), { timeout: 2_000 });
        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toMatchObject({ kind: 'sent' }),
        );
    });

    test("a late removal clears only its own claim: another session's claim stays", async () => {
        const answer = deferred();
        const requests = serveLedger(() => 200, [answer]);

        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        // The removal waits for the lock; meanwhile a newer drain session claims the op.
        const release = await holdWebLock(WRITE_LOCK);

        answer.resolve();
        await wait(30);
        const stored = await readOutboxKey();

        if (!stored) {
            throw new Error('no outbox key');
        }
        await writeOutboxKey({ ...stored, sending: { opId: 'op-1', session: 'newer' } });
        release();

        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect((await readOutboxKey())?.sending).toEqual({ opId: 'op-1', session: 'newer' });
    });

    test("N5: the drain release aborts the request in flight; a stale holder's late clear leaves the new holder's claim", async () => {
        const first = deferred();
        const second = deferred();
        const requests = serveLedger(index => (index === 0 ? 503 : 200), [first, second]);
        const page = fakeOutboxPage();

        setOutboxPage(page.page);
        await storeOutbox([storedOp(1, 'entry-a')]);
        const client = await openTab();

        await vi.waitFor(() => expect(requests).toHaveLength(1));
        // The drain lock is released on freeze (the request is aborted first) and taken again:
        // a new session adopts and claims the op.
        page.freeze();
        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toEqual({ kind: 'stopped' }),
        );
        page.show();
        await vi.waitFor(() => expect(requests).toHaveLength(2));
        const claim = (await readOutboxKey())?.sending;

        expect(claim).toMatchObject({ opId: 'op-1' });
        // The aborted request's late 503 reaches nobody.
        first.resolve();
        await vi.waitFor(() => expect(outboxGate.isClosed('auth')).toBe(false));
        expect((await readOutboxKey())?.sending).toEqual(claim);
        second.resolve();
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(requests).toHaveLength(2);
    });

    test('N4: the token changes while the claim waits for the lock: no claim written, no request, the auth gate closes', async () => {
        const requests = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        onlineManager.setOnline(true);
        await wait(30);
        auth.session = OTHER;
        idbLog.length = 0;
        release();

        await vi.waitFor(() => expect(outboxGate.isClosed('auth')).toBe(true));
        await wait(50);
        expect(requests).toEqual([]);
        expect(idbLog).toEqual([]);
    });

    test('N4: the token changes while the claim is written: checked again right before the request', async () => {
        const requests = serveLedger();

        vi.mocked(set).mockImplementation((key, value) => {
            if (key === OUTBOX_KEY && isClaimWrite(value)) {
                auth.session = OTHER;
            }
            return idb.set(key, value);
        });
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();

        await vi.waitFor(() => expect(outboxGate.isClosed('auth')).toBe(true));
        await wait(50);
        expect(requests).toEqual([]);
        expect((await readOutboxKey())?.sending).toBeNull();
    });
});

describe('03-15c1 removals and versions', () => {
    test('03-15a R2: a same-owner 2xx after a stop is processed; its failed removal is retried', async () => {
        const answer = deferred();
        const requests = serveLedger(() => 200, [answer]);
        let failRemovals = 1;

        await storeOutbox([storedOp(1, 'entry-a')]);
        vi.mocked(set).mockImplementation((key, value) => {
            if (key === OUTBOX_KEY && !isClaimWrite(value) && failRemovals > 0) {
                failRemovals -= 1;
                return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
            }
            return idb.set(key, value);
        });
        const client = await openTab();

        await vi.waitFor(() => expect(requests).toHaveLength(1));
        stopOutbox();
        answer.resolve();

        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toMatchObject({ kind: 'sent' }),
        );
        // The removal retries after its backoff (1 s ± 20 %) although the drain stopped.
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]), {
            timeout: 2_000,
        });
        expect(requests).toHaveLength(1);
    });

    test('a removal that finishes after a stop and a restart: the restore keeps the newer version, the next op sends it', async () => {
        const answer = deferred();
        const requests = serveLedger(() => 200, [answer]);
        let failRemovals = 1;
        let answered = false;

        await storeOutbox([updateOp(1, 'entry-x', '1'), updateOp(2, 'entry-x', '1')], {
            versions: { 'entry-x': 'v-old' },
        });
        vi.mocked(set).mockImplementation((key, value) => {
            if (key === OUTBOX_KEY && !isClaimWrite(value) && failRemovals > 0 && answered) {
                failRemovals -= 1;
                return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
            }
            return idb.set(key, value);
        });
        const client = await openTab();

        await vi.waitFor(() => expect(requests).toEqual(['PATCH entry-x If-Match "v-old"']));
        stopOutbox();
        answered = true;
        answer.resolve();
        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toMatchObject({ kind: 'sent' }),
        );
        expect(getOutboxVersion('entry-x')).toBe('v-1');

        await startLedgerOutbox(newClient(), USER, effects);
        expect(getOutboxVersion('entry-x')).toBe('v-1');
        await vi.waitFor(
            () =>
                expect(requests).toEqual([
                    'PATCH entry-x If-Match "v-old"',
                    'PATCH entry-x If-Match "v-1"',
                ]),
            { timeout: 2_000 },
        );
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]), {
            timeout: 2_000,
        });
    });

    test('N3: a version is kept when another tab appended an op of the entry, deleted only by the removal when none is left', async () => {
        const answer = deferred();
        const requests = serveLedger(() => 200, [answer]);

        await storeOutbox([updateOp(1, 'entry-x', '1')]);
        await openTab();
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        // Another tab appends an edit of the same entry while op-1 is answered.
        const stored = await readOutboxKey();

        if (!stored) {
            throw new Error('no outbox key');
        }
        await writeOutboxKey({
            ...stored,
            nextSeq: 3,
            ops: [...stored.ops, updateOp(2, 'entry-x', '1')],
        });
        answer.resolve();

        await vi.waitFor(async () =>
            expect((await readOutboxKey())?.ops.map(op => op.opId)).toEqual(['op-2']),
        );
        expect((await readOutboxKey())?.versions).toEqual({ 'entry-x': 'v-1' });
        expect(getOutboxVersion('entry-x')).toBe('v-1');
    });

    test('the version of an entry with no op left is deleted by the removal, in the key and in memory', async () => {
        const requests = serveLedger();

        await storeOutbox([updateOp(1, 'entry-x', '1')], { versions: { 'entry-x': '1' } });
        await openTab();
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect((await readOutboxKey())?.versions).toEqual({});
        expect(getOutboxVersion('entry-x')).toBeNull();
    });

    test('03-15a R2: cancellations are cleared per run, not on stop', async () => {
        const client = await openTab();

        onlineManager.setOnline(false);
        const op = await appendCreate('entry-a');

        await discardOps([op.opId]);
        stopOutbox();
        expect(isOpCancelled(op.opId)).toBe(true);
        expect((await readOutboxKey())?.cancelled).toEqual([op.opId]);

        await startLedgerOutbox(client, USER, effects);
        await expect(
            runOutboxOp(op, {
                send: () => Promise.reject(new Error('sent')),
                sessionUserId: () => USER,
            }),
        ).resolves.toEqual({ kind: 'cancelled' });
        await vi.waitFor(async () => expect((await readOutboxKey())?.cancelled).toEqual([]));
        expect(isOpCancelled(op.opId)).toBe(false);
    });
});

describe('03-15c1 the drain-session fence (M2)', () => {
    test('a run of the same owner from before a stop and restart touches no gate: its 401 resolves stopped', async () => {
        const answer = deferred();
        const requests = serveLedger(() => 401, [answer]);

        await storeOutbox([storedOp(1, 'entry-a')]);
        const first = await openTab();

        await vi.waitFor(() => expect(requests).toHaveLength(1));
        const mutation = firstMutation(first);

        stopOutbox();
        await startLedgerOutbox(first, USER, effects);
        expect(outboxGate.isClosed('auth')).toBe(false);
        answer.resolve();

        await vi.waitFor(() => expect(mutation?.state.data).toEqual({ kind: 'stopped' }));
        await wait(50);
        expect(outboxGate.isClosed('auth')).toBe(false);
        expect(requests).toHaveLength(1);
    });

    const switchAccountsAndBack = async (): Promise<QueryClient> => {
        // Another tab signs in Y, then X again: this tab's refresh listener sees both tokens. The
        // tab that signed Y in deleted X's outbox ("Delete and sign in", 03-16a part C), so this
        // tab counts nothing of X and clears X's data; a non-empty outbox of X would be kept.
        await idb.del(OUTBOX_KEY);
        await idb.del(FAILED_KEY);
        onAccessTokenRefreshed(fakeAccessToken(OTHER));
        await vi.waitFor(() => expect(getLocalUser()?.id).toBe(OTHER));
        onAccessTokenRefreshed(fakeAccessToken(USER));
        await vi.waitFor(() => expect(getLocalUser()?.id).toBe(USER));
        await wait(20);
        const client = newClient();

        await startLedgerOutbox(client, USER, effects);
        return client;
    };

    test("M2: X's request in flight across clearUserData(X) → Y → X: stopped, the new auth gate stays open, 0 extra requests", async () => {
        const answer = deferred();
        const requests = serveLedger(() => 401, [answer]);

        saveLocalUser({ id: USER, settings });
        await storeOutbox([storedOp(1, 'entry-a')]);
        const first = await openTab();

        await vi.waitFor(() => expect(requests).toHaveLength(1));
        const mutation = firstMutation(first);

        await switchAccountsAndBack();
        expect(outboxGate.isClosed('auth')).toBe(false);
        answer.resolve();

        await vi.waitFor(() => expect(mutation?.state.data).toEqual({ kind: 'stopped' }));
        await wait(50);
        expect(outboxGate.isClosed('auth')).toBe(false);
        expect(requests).toHaveLength(1);
    });

    test.each([422, 200])(
        'drain writes after clearUserData are no-ops: an old-run answer %i writes nothing, blocks nothing, resolves stopped',
        async status => {
            const answer = deferred();
            const requests = serveLedger(() => status, [answer]);

            saveLocalUser({ id: USER, settings });
            await storeOutbox([storedOp(1, 'entry-a')]);
            const first = await openTab();

            await vi.waitFor(() => expect(requests).toHaveLength(1));
            const mutation = firstMutation(first);

            await switchAccountsAndBack();
            const lastDel = idbLog.lastIndexOf(`del ${OUTBOX_KEY}`);

            expect(lastDel).toBeGreaterThan(-1);
            answer.resolve();

            await vi.waitFor(() => expect(mutation?.state.data).toEqual({ kind: 'stopped' }));
            await wait(50);
            expect(
                idbLog.slice(lastDel).filter(line => line.startsWith('set chipin:outbox')),
            ).toEqual([]);
            expect(outboxGate.isBlocked('entry-a')).toBe(false);
            expect(requests).toHaveLength(1);
        },
    );
});

// `AbortSignal.timeout` of the next lock requests: an already timed-out signal.
const timeOutNextLockRequests = (count = 1): void => {
    const spy = vi.spyOn(AbortSignal, 'timeout');

    for (let index = 0; index < count; index += 1) {
        spy.mockReturnValueOnce(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    }
};

const storeBothKeys = async (): Promise<void> => {
    await storeOutbox([storedOp(1, 'entry-a')]);
    await idb.set(FAILED_KEY, persistCodec.stringify([]));
};

const expectKeysDeleted = async (): Promise<void> => {
    expect(await idb.get(OUTBOX_KEY)).toBeUndefined();
    expect(await idb.get(FAILED_KEY)).toBeUndefined();
};

describe('03-15c1 R1: the delete, the restore read and the fallbacks', () => {
    test('L1: the clearUserData delete retries after a lock timeout; the lock released → both keys deleted', async () => {
        onlineManager.setOnline(false);
        await storeBothKeys();
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        timeOutNextLockRequests();
        const cleared = clearUserData(USER, () => undefined);

        await wait(100);
        expect(await idb.get(OUTBOX_KEY)).toBeDefined();
        release();
        await cleared;
        await expectKeysDeleted();
    });

    test('L1: a lock that is never granted: after the last timeout the keys are deleted without it', async () => {
        onlineManager.setOnline(false);
        await storeBothKeys();
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        timeOutNextLockRequests(3);
        await clearUserData(USER, () => undefined);
        await expectKeysDeleted();
        release();
    });

    test('L2: a lock timeout on the first read keeps the restore pending and retries it', async () => {
        await storeOutbox([storedOp(1, 'entry-a')]);
        resetOutbox();
        onlineManager.setOnline(false);
        const release = await holdWebLock(WRITE_LOCK);

        timeOutNextLockRequests();
        const restored = startLedgerOutbox(newClient(), USER, effects);

        await wait(50);
        expect(outboxRestoreState(USER)).toBe('pending');
        release();
        await expect(restored).resolves.toBe('ok');
        expect(pendingOutboxOps().map(op => op.opId)).toEqual(['op-1']);
    });

    test('L3: flag off, an account switch and clearUserData request no lock and delete the keys', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'false');
        saveLocalUser({ id: USER, settings });
        await storeBothKeys();
        const request = vi.spyOn(navigator.locks, 'request');

        onAccessTokenRefreshed(fakeAccessToken(OTHER));
        await wait(50);
        await clearUserData(OTHER, () => undefined);

        expect(request).not.toHaveBeenCalled();
        await expectKeysDeleted();
    });

    test('L3: flag on, the delete waits for a held write lock and lands after its release', async () => {
        onlineManager.setOnline(false);
        await storeBothKeys();
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);
        const cleared = clearUserData(USER, () => undefined);

        await wait(50);
        expect(await idb.get(OUTBOX_KEY)).toBeDefined();
        release();
        await cleared;
        await expectKeysDeleted();
    });

    test('L3: without Web Locks the online path is chosen; persisted ops are still restored and sent', async () => {
        const requests = serveLedger();

        await storeOutbox([storedOp(1, 'entry-a')]);
        removeWebLocks();
        const client = await openTab();

        expect(chooseLedgerWritePath(client, { kind: 'create' })).toBe('online');
        await vi.waitFor(() => expect(requests).toEqual(['POST entry-a']));
    });

    test('L5: without AbortSignal.timeout the write lock still works and still times out', async () => {
        const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');

        Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined });
        try {
            onlineManager.setOnline(false);
            await openTab();
            await expect(appendCreate('entry-a')).resolves.toMatchObject({ opId: 'op-1' });

            const release = await holdWebLock(WRITE_LOCK);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const appended = appendCreate('entry-b').catch((error: unknown) => error);

            await vi.advanceTimersByTimeAsync(5_000);
            expect(await appended).toBeInstanceOf(OutboxPersistError);
            vi.useRealTimers();
            release();
        } finally {
            vi.useRealTimers();
            if (descriptor) {
                Object.defineProperty(AbortSignal, 'timeout', descriptor);
            } else {
                Reflect.deleteProperty(AbortSignal, 'timeout');
            }
        }
    });
});

describe('03-15c1 R1: reports, disposed users, stale runs', () => {
    test('N1: a lock timeout of a drain write is reported as a lock timeout, not as a persistence failure', async () => {
        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);

        timeOutNextLockRequests();
        onlineManager.setOnline(true);
        await vi.waitFor(() =>
            expect(Sentry.captureMessage).toHaveBeenCalledWith('outbox.write_lock_timeout', {
                level: 'warning',
            }),
        );
        expect(reportPersistFailed).not.toHaveBeenCalled();
        release();
    });

    test('N1: a lock request refused for another reason is no lock timeout: offline writing turns off', async () => {
        onlineManager.setOnline(false);
        await openTab();
        vi.spyOn(navigator.locks, 'request').mockRejectedValueOnce(new TypeError('refused'));

        await expect(appendCreate('entry-a')).rejects.toBeInstanceOf(OutboxPersistError);
        expect(isOutboxPersistFailed()).toBe(true);
    });

    test('N2: IO of a cleared user queued in the tab is refused without requesting the lock', async () => {
        onlineManager.setOnline(false);
        await openTab();
        const release = await holdWebLock(WRITE_LOCK);
        const request = vi.spyOn(navigator.locks, 'request');
        const first = appendCreate('entry-a').catch((error: unknown) => error);
        const second = appendCreate('entry-b').catch((error: unknown) => error);

        await wait(10);
        const cleared = clearUserData(USER, () => undefined);

        release();
        expect(await first).toBeInstanceOf(OutboxWriteStoppedError);
        expect(await second).toBeInstanceOf(OutboxWriteStoppedError);
        await cleared;
        // The first append (requested before the clear) and the delete; never the second append.
        expect(request.mock.calls.filter(([name]) => name === WRITE_LOCK)).toHaveLength(2);
    });

    test('N4: a run that went stale while it cleared its claim after a 5xx sets no status', async () => {
        const answer = deferred();
        const requests = serveLedger(() => 503, [answer]);

        await storeOutbox([storedOp(1, 'entry-a')]);
        const client = await openTab();

        await vi.waitFor(() => expect(requests).toHaveLength(1));
        const release = await holdWebLock(WRITE_LOCK);

        answer.resolve();
        await wait(30);
        stopOutbox();
        release();

        await vi.waitFor(() =>
            expect(firstMutation(client)?.state.data).toEqual({ kind: 'stopped' }),
        );
        expect(outboxStatus('op-1')).toBeUndefined();
    });
});

describe('03-15c1 R2', () => {
    test("M1: a retried clearUserData delete lands before the same user's new session reads or writes", async () => {
        const requests = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        timeOutNextLockRequests();
        const cleared = clearUserData(USER, () => undefined);

        await wait(10);
        // The same user signs in again while the delete waits for its retry.
        const client = newClient();

        await startLedgerOutbox(client, USER, effects);
        expect(pendingOutboxOps()).toEqual([]);
        await appendOutboxOp(seq => ({
            ...storedOp(seq, 'entry-b'),
            opId: 'op-new',
            kind: 'createExpense' as const,
            entryKind: 'expense' as const,
            schema: 1 as const,
        }));
        await cleared;

        expect((await readOutboxKey())?.ops.map(op => op.opId)).toEqual(['op-new']);
        // The client adopts the appended op (as the ledger append path does) and sends it.
        await startLedgerOutbox(client, USER, effects);
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(requests).toEqual(['POST entry-b']));
        await wait(50);
        expect(requests).toEqual(['POST entry-b']);
    });

    test('N1: a restore read that times out on the lock three times reports one lock timeout', async () => {
        await storeOutbox([storedOp(1, 'entry-a')]);
        resetOutbox();
        onlineManager.setOnline(false);
        const release = await holdWebLock(WRITE_LOCK);

        timeOutNextLockRequests(3);
        // Only the backoff timers are fake: the read retries after 1 s, 2 s, then waits 4 s.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            const restored = startLedgerOutbox(newClient(), USER, effects);

            await vi.advanceTimersByTimeAsync(1_000);
            await vi.advanceTimersByTimeAsync(2_000);
            expect(vi.mocked(AbortSignal.timeout).mock.calls).toHaveLength(3);
            expect(outboxRestoreState(USER)).toBe('pending');
            expect(
                vi
                    .mocked(Sentry.captureMessage)
                    .mock.calls.filter(([message]) => message === 'outbox.write_lock_timeout'),
            ).toHaveLength(1);
            release();
            await vi.advanceTimersByTimeAsync(4_000);
            await expect(restored).resolves.toBe('ok');
        } finally {
            vi.useRealTimers();
        }
    });

    test('L1: two clears of the user, the first delete retrying: the new session waits for both deletes', async () => {
        const requests = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        await openTab();
        timeOutNextLockRequests();
        const first = clearUserData(USER, () => undefined);

        await wait(10);
        // A sign-in and a sign-out again: the second delete lands at once.
        const second = clearUserData(USER, () => undefined);

        await wait(10);
        const client = newClient();

        await startLedgerOutbox(client, USER, effects);
        expect(pendingOutboxOps()).toEqual([]);
        await appendOutboxOp(seq => ({
            ...storedOp(seq, 'entry-b'),
            opId: 'op-new',
            kind: 'createExpense' as const,
            entryKind: 'expense' as const,
            schema: 1 as const,
        }));
        await Promise.all([first, second]);

        expect((await readOutboxKey())?.ops.map(op => op.opId)).toEqual(['op-new']);
        await startLedgerOutbox(client, USER, effects);
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(requests).toEqual(['POST entry-b']));
        await wait(50);
        expect(requests).toEqual(['POST entry-b']);
    });
});
