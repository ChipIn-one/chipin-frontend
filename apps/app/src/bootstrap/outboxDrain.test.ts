// Spec 03 §8 "Two tabs (D29)", the rows of PR 03-15c2: the drain lock, the `BroadcastChannel` ping,
// append from any tab, Retry/discard from any tab, the release on hidden/freeze. Each "tab" is a
// separate instance of the outbox modules (`vi.resetModules`) with its own client and page
// lifecycle, over one fake IndexedDB, one in-memory lock manager and one in-memory channel.
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LedgerWriteEffects } from 'entities/ledger/api/mutations';
import type { ExpenseDraft } from 'entities/ledger/model/types';
import { currencyCode, fromUnits } from 'shared/money';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import type { OutboxRestore } from 'shared/offline/outboxStore';
import { persistCodec } from 'shared/offline/persistCodec';
import { fakeBroadcastChannels } from 'test/broadcastChannel';
import { setupMswServer } from 'test/mswServer';
import { type FakeOutboxPage, fakeOutboxPage } from 'test/outboxPage';
import { fakeWebLocks } from 'test/webLocks';

import 'fake-indexeddb/auto';

const auth = vi.hoisted(() => ({ session: 'user-1' }));
// A write of the outbox key that matches is rejected (a failing removal write).
// A read that matches is rejected too (a failing restore or re-read); `rejectedGets` counts them.
const idbControl = vi.hoisted(() => ({
    rejectSet: (_value: unknown): boolean => false,
    rejectGet: false,
    rejectedGets: 0,
}));

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
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return {
        ...actual,
        get: (key: IDBValidKey) => {
            if (idbControl.rejectGet) {
                idbControl.rejectedGets += 1;
                return Promise.reject(new DOMException('read failed', 'UnknownError'));
            }
            return actual.get(key);
        },
        set: (key: IDBValidKey, value: unknown) =>
            idbControl.rejectSet(value)
                ? Promise.reject(new DOMException('quota', 'QuotaExceededError'))
                : actual.set(key, value),
    };
});

const idb = await vi.importActual<typeof import('idb-keyval')>('idb-keyval');

const USER = 'user-1';
const OUTBOX_KEY = outboxStateKey(USER);
const FAILED_KEY = outboxFailedKey(USER);
const DRAIN_LOCK = `chipin-outbox-drain:${USER}`;

const server = setupMswServer();

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

/** Lets the pending promises, channel messages and IndexedDB callbacks run (no fixed delay). */
const flush = async (): Promise<void> => {
    for (let round = 0; round < 10; round += 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
};

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

const updateOp = (seq: number, entryId: string, baseVersion: string) =>
    storedOp(seq, entryId, {
        kind: 'updateExpense',
        baseVersion,
        patch: { description: 'changed' },
        draft: undefined,
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

const storeFailed = (op: unknown): Promise<void> =>
    idb.set(FAILED_KEY, persistCodec.stringify([{ op, reason: 'validation', failedAt: 1 }]));

interface StoredOutbox {
    ops: { opId: string }[];
    versions: Record<string, string>;
    cancelled: string[];
    retryRequested: string[];
    sending: { opId: string; session: string } | null;
}

const isStoredOutbox = (value: unknown): value is StoredOutbox =>
    typeof value === 'object' && value !== null && 'ops' in value && Array.isArray(value.ops);

const readOutboxKey = async (): Promise<StoredOutbox | null> => {
    const text = await idb.get<unknown>(OUTBOX_KEY);
    const stored: unknown = typeof text === 'string' ? persistCodec.parse(text) : null;

    return isStoredOutbox(stored) ? stored : null;
};

const readFailedKey = async (): Promise<unknown[]> => {
    const text = await idb.get<unknown>(FAILED_KEY);
    const stored: unknown = typeof text === 'string' ? persistCodec.parse(text) : [];

    return Array.isArray(stored) ? stored.map((record: unknown) => record) : [];
};

// A write of the outbox key that only removes ops (no claim): the removal after a success.
const isRemovalWrite = (value: unknown): boolean => {
    const stored: unknown = typeof value === 'string' ? persistCodec.parse(value) : null;

    return isStoredOutbox(stored) && stored.sending === null;
};

interface Ledger {
    /** Every request: `POST <id>` or `PATCH <id> If-Match <version>`. */
    requests: string[];
    /** The entries the server holds, with their version. */
    entries: Map<string, number>;
    /** The most requests ever in flight at once. */
    maxInFlight: () => number;
    /** Per request: whether the client aborted it. */
    aborted: () => boolean[];
}

/**
 * A ledger server with the idempotence of BE-03-2 (a create of a known id answers the entry) and
 * BE-03-1 (a PATCH of a known `X-Client-Op-Id` answers the current entry before the `If-Match`
 * check). The write is applied before `holds[n]` holds the n-th answer (a holder that dies or is
 * aborted mid-request); `failFirst` answers the first request with this status instead.
 */
const serveLedger = ({
    holds = [],
    failFirst,
}: { holds?: Deferred[]; failFirst?: number } = {}): Ledger => {
    const requests: string[] = [];
    const entries = new Map<string, number>();
    const appliedOps = new Set<string>();
    let inFlight = 0;
    let maxInFlight = 0;
    const signals: AbortSignal[] = [];
    // msw does not abort `request.signal` in Node: the signal a request was sent with is the
    // drain session's of the tab holding the lock. An aborted request no longer counts as in
    // flight (a tab that closed or froze).
    const senderSignal = (): AbortSignal =>
        tabs.find(tab => tab.drain.outboxDrainState() === 'holding')?.store.outboxSessionSignal() ??
        new AbortController().signal;
    const whenAborted = (signal: AbortSignal): Promise<void> =>
        new Promise(resolve => {
            signal.addEventListener('abort', () => resolve());
        });
    const answer = async (
        label: string,
        signal: AbortSignal,
        apply: () => Response,
    ): Promise<Response> => {
        const index = requests.length;

        requests.push(label);
        signals.push(signal);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
            if (index === 0 && failFirst !== undefined) {
                return HttpResponse.json({ code: 'TEST.ERROR' }, { status: failFirst });
            }
            const response = apply();

            await Promise.race([holds[index]?.promise, whenAborted(signal)]);
            return response;
        } finally {
            inFlight -= 1;
        }
    };
    const entry = (id: string): Response =>
        HttpResponse.json({ id, type: 'EXPENSE', version: `v${entries.get(id) ?? 0}` });

    server.use(
        http.post('*/ledger/entries', async ({ request }) => {
            const body: unknown = await request.json();
            const id =
                typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '?';

            return answer(`POST ${id}`, senderSignal(), () => {
                entries.set(id, entries.get(id) ?? 1);
                return entry(id);
            });
        }),
        http.patch('*/ledger/entries/:id', ({ request, params }) => {
            const id = String(params.id);
            const ifMatch = request.headers.get('If-Match') ?? '';
            const opId = request.headers.get('X-Client-Op-Id') ?? '';

            return answer(`PATCH ${id} If-Match ${ifMatch}`, senderSignal(), () => {
                const version = entries.get(id) ?? 0;

                if (appliedOps.has(opId)) {
                    return entry(id);
                }
                if (ifMatch !== `"v${version}"`) {
                    return HttpResponse.json({ code: 'LEDGER.VERSION_CONFLICT' }, { status: 409 });
                }
                appliedOps.add(opId);
                entries.set(id, version + 1);
                return entry(id);
            });
        }),
    );
    return {
        requests,
        entries,
        maxInFlight: () => maxInFlight,
        aborted: () => signals.map(signal => signal.aborted),
    };
};

interface Tab {
    client: QueryClient;
    page: FakeOutboxPage;
    effects: LedgerWriteEffects;
    started: Promise<OutboxRestore>;
    ledger: typeof import('entities/ledger/api/outbox');
    drain: typeof import('shared/offline/outboxDrain');
    store: typeof import('shared/offline/outboxStore');
    registry: typeof import('shared/offline/outboxRegistry');
    run: typeof import('shared/offline/outboxRun');
}

const tabs: Tab[] = [];

/** A new tab of the user: its own module instances, client and page; its outbox starts. */
const openTab = async ({ hidden = false }: { hidden?: boolean } = {}): Promise<Tab> => {
    vi.resetModules();
    const caches = await import('shared/offline/userCaches');
    const { createQueryClient } = await import('shared/api/queryClient');
    const { capabilitiesQueryOptions } = await import('entities/ledger/api/queries');
    const ledger = await import('entities/ledger/api/outbox');
    const drain = await import('shared/offline/outboxDrain');
    const store = await import('shared/offline/outboxStore');
    const registry = await import('shared/offline/outboxRegistry');
    const run = await import('shared/offline/outboxRun');
    const page = fakeOutboxPage(hidden);
    const client = createQueryClient();
    const effects: LedgerWriteEffects = {
        onEntryWritten: vi.fn(() => Promise.resolve()),
        onWriteFailed: vi.fn(() => Promise.resolve()),
    };

    drain.setOutboxPage(page.page);
    caches.cachesByUser.set(USER, {
        client,
        ready: Promise.resolve(),
        isReady: true,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    });
    client.setQueryData(capabilitiesQueryOptions().queryKey, [
        'ledger.clientEntryId',
        'ledger.entryVersion',
        'client.minVersion',
    ]);
    const tab: Tab = {
        client,
        page,
        effects,
        started: ledger.startLedgerOutbox(client, USER, effects),
        ledger,
        drain,
        store,
        registry,
        run,
    };

    tabs.push(tab);
    return tab;
};

const queueCreate = (tab: Tab): Promise<void> =>
    tab.ledger.createExpenseViaOutbox(tab.client, { expense })?.() ??
    Promise.reject(new Error('the online path was chosen'));

const queueUpdate = (tab: Tab, entryId: string) =>
    tab.registry
        .enqueueOutboxOp(
            tab.client,
            { kind: 'updateExpense', entryId, owner: USER },
            ({ base, baseVersion }) => ({
                ...base,
                kind: 'updateExpense' as const,
                groupId: null,
                parentActivityId: null,
                baseVersion,
                patch: { description: 'changed' },
            }),
        )
        .then(op => {
            tab.drain.adoptIfDraining();
            return op;
        });

const mutationResults = (tab: Tab): unknown[] =>
    tab.client
        .getMutationCache()
        .getAll()
        .map(mutation => mutation.state.data);

const isDrainHeld = (): boolean => fakeWebLocks()?.isHeld(DRAIN_LOCK) ?? false;

beforeEach(async () => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    auth.session = USER;
    idbControl.rejectSet = () => false;
    idbControl.rejectGet = false;
    idbControl.rejectedGets = 0;
    onlineManager.setOnline(true);
    await clear();
});

afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(tabs.map(tab => tab.drain.stopOutboxDrain()));
    tabs.forEach(tab => tab.store.resetOutbox());
    tabs.length = 0;
    onlineManager.setOnline(true);
    vi.unstubAllEnvs();
});

describe('03-15c2 two tabs: append in any tab, one drain tab (D29)', () => {
    test('an op written in tab B is sent exactly once by A; the overlay and the settle reach both tabs', async () => {
        const ledger = serveLedger();
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        expect(tabA.drain.outboxDrainState()).toBe('holding');
        expect(tabB.drain.outboxDrainState()).toBe('waiting');

        await queueCreate(tabB);
        const [op] = tabB.store.pendingOutboxOps();

        // B appended without adopting: no mutation, no request from B.
        expect(tabB.client.getMutationCache().getAll()).toEqual([]);
        await vi.waitFor(() => expect(ledger.requests).toEqual([`POST ${op?.entryId}`]));
        await vi.waitFor(() => expect(tabB.effects.onEntryWritten).toHaveBeenCalledTimes(1));
        expect(tabA.effects.onEntryWritten).toHaveBeenCalledTimes(1);
        await vi.waitFor(() => expect(tabB.store.pendingOutboxOps()).toEqual([]));
        expect(tabA.store.pendingOutboxOps()).toEqual([]);
        expect(ledger.requests).toHaveLength(1);
        expect(tabB.client.getMutationCache().getAll()).toEqual([]);
    });

    test('a simultaneous start of two tabs: exactly one tab adopts and sends', async () => {
        const ledger = serveLedger();

        await storeOutbox([storedOp(1, 'entry-a')]);
        const [tabA, tabB] = await Promise.all([openTab(), openTab()]);

        await Promise.all([tabA.started, tabB.started]);
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        const adopted = [tabA, tabB].map(tab => tab.client.getMutationCache().getAll().length);

        expect(adopted.sort()).toEqual([0, 1]);
        expect(ledger.requests).toHaveLength(1);
    });

    test('the holder dies mid-request: the next holder clears its stale claim and resends with the same id, no duplicate', async () => {
        const never = deferred();
        const ledger = serveLedger({ holds: [never] });

        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        expect((await readOutboxKey())?.sending).toMatchObject({ opId: 'op-1' });

        // A crashes: the browser releases its lock, its request never answers.
        void tabA.drain.stopOutboxDrain();

        await vi.waitFor(() => expect(tabB.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a', 'POST entry-a']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect([...ledger.entries.keys()]).toEqual(['entry-a']);
        expect((await readOutboxKey())?.sending).toBeNull();
        // L2: the stop aborted A's request before B could resend it.
        expect(ledger.aborted()).toEqual([true, false]);
        expect(ledger.maxInFlight()).toBe(1);
    });

    test('a new holder clears the stale claim of a dead holder on acquisition', async () => {
        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')], {
            sending: { opId: 'op-1', session: 'dead-holder' },
        });
        const tabA = await openTab();

        await tabA.started;
        expect((await readOutboxKey())?.sending).toBeNull();
        // The op is no longer refused as "already sending".
        await expect(tabA.drain.discardOutboxOps(['op-1'])).resolves.toEqual({
            discarded: ['op-1'],
            refused: [],
        });
    });

    test('fresh version in a non-drain tab: B edits after A sent an edit of the same entry, If-Match is the new version', async () => {
        const ledger = serveLedger();

        ledger.entries.set('entry-x', 1);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        [tabA, tabB].forEach(tab =>
            tab.client.setQueryData(tab.registry.ledgerEntryKey('entry-x'), {
                type: 'EXPENSE',
                version: 'v1',
            }),
        );
        await queueUpdate(tabA, 'entry-x');
        await vi.waitFor(() => expect(tabB.effects.onEntryWritten).toHaveBeenCalledTimes(1));

        const second = await queueUpdate(tabB, 'entry-x');

        expect(second.baseVersion).toBe('v2');
        await vi.waitFor(() =>
            expect(ledger.requests).toEqual([
                'PATCH entry-x If-Match "v1"',
                'PATCH entry-x If-Match "v2"',
            ]),
        );
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(await readFailedKey()).toEqual([]);
    });

    test('a failed op of entry X in A does not block entry Y appended in B', async () => {
        const ledger = serveLedger();

        await storeFailed(storedOp(1, 'entry-x'));
        await storeOutbox([storedOp(2, 'entry-x')], { nextSeq: 3 });
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        await queueCreate(tabB);
        const entryY = tabB.store.pendingOutboxOps().find(op => op.entryId !== 'entry-x');

        await vi.waitFor(() => expect(ledger.requests).toEqual([`POST ${entryY?.entryId}`]));
        await vi.waitFor(() =>
            expect(tabA.store.pendingOutboxOps().map(op => op.opId)).toEqual(['op-2']),
        );
    });

    test('a holder frozen without releasing: B still saves, sends nothing and shows the badge hint', async () => {
        const ledger = serveLedger();
        const tabA = await openTab();

        await tabA.started;
        // A holds the lock and never runs again (frozen before it could release).
        tabA.store.stopOutbox();
        const tabB = await openTab();

        await tabB.started;
        expect(tabB.drain.isSendingInAnotherTab()).toBe(false);
        await queueCreate(tabB);
        await flush();

        expect(tabB.store.pendingOutboxOps()).toHaveLength(1);
        expect(tabB.drain.outboxDrainState()).toBe('waiting');
        expect(tabB.drain.isSendingInAnotherTab()).toBe(true);
        expect(tabB.client.getMutationCache().getAll()).toEqual([]);
        expect(ledger.requests).toEqual([]);
    });

    test('no BroadcastChannel or no Web Locks: offline writing is off', async () => {
        const tab = await openTab();

        await tab.started;
        expect(tab.ledger.chooseLedgerWritePath(tab.client, { kind: 'create' })).toBe('outbox');
        const channel = Reflect.get(globalThis, 'BroadcastChannel');

        Reflect.deleteProperty(globalThis, 'BroadcastChannel');
        expect(tab.ledger.chooseLedgerWritePath(tab.client, { kind: 'create' })).toBe('online');
        Reflect.set(globalThis, 'BroadcastChannel', channel);
        const locks: unknown = navigator.locks;

        Reflect.deleteProperty(navigator, 'locks');
        expect(tab.ledger.chooseLedgerWritePath(tab.client, { kind: 'create' })).toBe('online');
        Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
    });
});

describe('03-15c2 Retry and discard from any tab', () => {
    test('Retry pressed in B is executed by A: the failed op is claimed and sent, not cancelled', async () => {
        const ledger = serveLedger();

        await storeFailed(storedOp(1, 'entry-x'));
        await storeOutbox([], { nextSeq: 2 });
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        await expect(tabB.drain.retryOutboxOps(['op-1'])).resolves.toEqual(['op-1']);

        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-x']));
        await vi.waitFor(() =>
            expect(mutationResults(tabA)).toEqual([expect.objectContaining({ kind: 'sent' })]),
        );
        await vi.waitFor(async () => expect(await readFailedKey()).toEqual([]));
        expect((await readOutboxKey())?.retryRequested).toEqual([]);
        expect(tabA.run.isOutboxRetrying('op-1')).toBe(false);
    });

    test('the whenTurn of a Retry waits its turn behind the op in flight', async () => {
        const answer = deferred();
        const ledger = serveLedger({ holds: [answer] });

        await storeFailed(storedOp(1, 'entry-x'));
        await storeOutbox([storedOp(2, 'entry-y')], { nextSeq: 3 });
        const tabA = await openTab();

        await tabA.started;
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-y']));
        await tabA.drain.retryOutboxOps(['op-1']);
        await flush();
        expect(ledger.requests).toEqual(['POST entry-y']);
        expect(tabA.run.isOutboxRetrying('op-1')).toBe(true);

        answer.resolve();
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-y', 'POST entry-x']));
        await vi.waitFor(async () => expect(await readFailedKey()).toEqual([]));
        expect(ledger.maxInFlight()).toBe(1);
        expect(tabA.run.isOutboxRetrying('op-1')).toBe(false);
    });

    test('Cancel pressed in B is executed by A: the waiting run resolves cancelled, 0 requests', async () => {
        const ledger = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        await expect(tabB.drain.discardOutboxOps(['op-1'])).resolves.toEqual({
            discarded: ['op-1'],
            refused: [],
        });
        await vi.waitFor(() => expect(mutationResults(tabA)).toEqual([{ kind: 'cancelled' }]));
        onlineManager.setOnline(true);
        await vi.waitFor(async () => expect((await readOutboxKey())?.cancelled).toEqual([]));
        expect(ledger.requests).toEqual([]);
    });

    test("L4: a discard in B of A's in-flight op is refused; the request completes normally", async () => {
        const answer = deferred();
        const ledger = serveLedger({ holds: [answer] });

        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        await expect(tabB.drain.discardOutboxOps(['op-1'])).resolves.toEqual({
            discarded: [],
            refused: ['op-1'],
        });
        answer.resolve();
        await vi.waitFor(() =>
            expect(mutationResults(tabA)).toEqual([expect.objectContaining({ kind: 'sent' })]),
        );
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(ledger.requests).toEqual(['POST entry-a']);
    });

    test('cancelled is cleaned for ops discarded before any tab adopted them', async () => {
        onlineManager.setOnline(false);
        const tab = await openTab({ hidden: true });

        await tab.started;
        expect(tab.drain.outboxDrainState()).toBe('waiting');
        await queueCreate(tab);
        const [op] = tab.store.pendingOutboxOps();

        await tab.drain.discardOutboxOps(op ? [op.opId] : []);
        expect((await readOutboxKey())?.cancelled).toEqual([op?.opId]);

        tab.page.show();
        await vi.waitFor(() => expect(tab.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(async () => expect((await readOutboxKey())?.cancelled).toEqual([]));
        expect(tab.client.getMutationCache().getAll()).toEqual([]);
    });
});

describe('03-15c2 the drain lock release (hidden, freeze, pagehide)', () => {
    test('one tab hidden → visible: the lock is released and taken again, the queued op is still sent', async () => {
        const ledger = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        const tab = await openTab();

        await tab.started;
        tab.page.hide();
        await vi.waitFor(() => expect(isDrainHeld()).toBe(false));
        await vi.waitFor(() => expect(mutationResults(tab)).toEqual([{ kind: 'stopped' }]));

        tab.page.show();
        await vi.waitFor(() => expect(tab.drain.outboxDrainState()).toBe('holding'));
        onlineManager.setOnline(true);
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(ledger.requests).toHaveLength(1);
    });

    test('a hidden tab that gets the drain lock does not drain; it drains once visible', async () => {
        const ledger = serveLedger();

        onlineManager.setOnline(false);
        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        tabB.page.hide();
        onlineManager.setOnline(true);
        // A closes: B's queued request is granted while B is hidden.
        await tabA.drain.stopOutboxDrain();
        await flush();

        expect(tabB.drain.outboxDrainState()).toBe('waiting');
        expect(isDrainHeld()).toBe(false);
        expect(tabB.client.getMutationCache().getAll()).toEqual([]);
        expect(ledger.requests).toEqual([]);

        tabB.page.show();
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
    });

    test('hidden with a request in flight: the lock goes only after it settled, B then holds without a resend', async () => {
        const answer = deferred();
        const ledger = serveLedger({ holds: [answer] });

        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await vi.waitFor(() => expect(ledger.requests).toHaveLength(1));
        tabA.page.hide();
        await flush();
        expect(tabA.drain.outboxDrainState()).toBe('holding');

        answer.resolve();
        await vi.waitFor(() => expect(tabB.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(ledger.requests).toHaveLength(1);
    });

    test('freeze with a request in flight: it is aborted, B resends after it, no concurrent request, no false conflict', async () => {
        const never = deferred();
        const ledger = serveLedger({ holds: [never] });

        ledger.entries.set('entry-x', 1);
        await storeOutbox([updateOp(1, 'entry-x', 'v1')]);
        const tabA = await openTab();

        await tabA.started;
        await vi.waitFor(() => expect(ledger.requests).toHaveLength(1));
        const tabB = await openTab();

        await tabB.started;
        tabA.page.freeze();
        // Aborted: A's run resolves `stopped` although the server never answered.
        await vi.waitFor(() => expect(mutationResults(tabA)).toEqual([{ kind: 'stopped' }]));
        await vi.waitFor(() =>
            expect(mutationResults(tabB)).toEqual([expect.objectContaining({ kind: 'sent' })]),
        );
        expect(ledger.requests).toEqual([
            'PATCH entry-x If-Match "v1"',
            'PATCH entry-x If-Match "v1"',
        ]);
        expect(ledger.entries.get('entry-x')).toBe(2);
        expect(ledger.aborted()).toEqual([true, false]);
        expect(ledger.maxInFlight()).toBe(1);
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(await readFailedKey()).toEqual([]);
    });

    test('a run in backoff across hidden → visible: its op is sent once', async () => {
        const ledger = serveLedger({ failFirst: 503 });

        await storeOutbox([storedOp(1, 'entry-a')]);
        const tab = await openTab();

        await tab.started;
        await vi.waitFor(() => expect(ledger.requests).toHaveLength(1));
        await vi.waitFor(async () => expect((await readOutboxKey())?.sending).toBeNull());

        tab.page.hide();
        await vi.waitFor(() => expect(isDrainHeld()).toBe(false));
        // Without the lock the run leaves its backoff without a request: no tab sends it twice.
        expect(mutationResults(tab)).toEqual([{ kind: 'stopped' }]);
        tab.page.show();
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a', 'POST entry-a']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(
            mutationResults(tab).filter(
                result => typeof result === 'object' && result !== null && 'entry' in result,
            ),
        ).toHaveLength(1);
        expect(ledger.requests).toHaveLength(2);
    });

    test('re-acquisition during a pending removal keeps the in-memory version: no false conflict', async () => {
        const ledger = serveLedger();
        let rejectRemovals = 1;

        ledger.entries.set('entry-x', 1);
        idbControl.rejectSet = value => {
            if (rejectRemovals > 0 && isRemovalWrite(value) && ledger.requests.length === 1) {
                rejectRemovals -= 1;
                return true;
            }
            return false;
        };
        // The key still holds the version op-1 was based on (its removal has not landed).
        await storeOutbox([updateOp(1, 'entry-x', 'v1')], { versions: { 'entry-x': 'v1' } });
        // The removal's backoff runs on fake timers (no real second of waiting).
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const tab = await openTab();

        tab.client.setQueryData(tab.registry.ledgerEntryKey('entry-x'), {
            type: 'EXPENSE',
            version: 'v1',
        });
        await tab.started;
        await vi.waitFor(() => expect(ledger.requests).toHaveLength(1));
        await vi.waitFor(() => expect(rejectRemovals).toBe(0));
        // The removal of op-1 retries after its backoff; meanwhile an edit is queued and the tab
        // releases and takes the lock again.
        onlineManager.setOnline(false);
        await queueUpdate(tab, 'entry-x');
        tab.page.hide();
        await vi.waitFor(() => expect(isDrainHeld()).toBe(false));
        tab.page.show();
        await vi.waitFor(() => expect(tab.drain.outboxDrainState()).toBe('holding'));
        onlineManager.setOnline(true);
        await vi.waitFor(() =>
            expect(ledger.requests).toEqual([
                'PATCH entry-x If-Match "v1"',
                'PATCH entry-x If-Match "v2"',
            ]),
        );
        await vi.advanceTimersByTimeAsync(2_000);
        vi.useRealTimers();
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(await readFailedKey()).toEqual([]);
    });
});

describe('03-15c2 logout and the flag', () => {
    test('clearUserData step (1): the drain lock is released and the channel closed', async () => {
        const tab = await openTab();

        await tab.started;
        expect(isDrainHeld()).toBe(true);
        expect(fakeBroadcastChannels()?.openCount(`chipin-outbox:${USER}`)).toBe(1);
        const { clearUserData } = await import('shared/offline/clearUserData');

        await clearUserData(USER, () => undefined);
        await flush();

        expect(isDrainHeld()).toBe(false);
        expect(fakeBroadcastChannels()?.openCount(`chipin-outbox:${USER}`)).toBe(0);
        expect(tab.page.listenerCount()).toBe(0);
        expect(tab.drain.outboxDrainState()).toBe('off');
    });

    test('flag off: no lock requested, no channel created, no listener added', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'false');
        const request = vi.spyOn(navigator.locks, 'request');
        const documentListener = vi.spyOn(document, 'addEventListener');
        const windowListener = vi.spyOn(window, 'addEventListener');
        const { startUserOutbox } = await import('bootstrap/outboxWiring');
        const { createQueryClient } = await import('shared/api/queryClient');

        startUserOutbox(createQueryClient(), USER);
        const tab = await openTab();

        await expect(tab.started).resolves.toBe('pending');
        await flush();

        expect(request).not.toHaveBeenCalled();
        expect(fakeBroadcastChannels()?.openCount(`chipin-outbox:${USER}`)).toBe(0);
        expect(tab.page.listenerCount()).toBe(0);
        expect(documentListener).not.toHaveBeenCalled();
        expect(windowListener).not.toHaveBeenCalled();
    });
});

describe('03-15c2 R1', () => {
    test('M1: a tab whose restore failed never takes the drain lock; a healthy tab drains', async () => {
        const ledger = serveLedger();

        await storeOutbox([storedOp(1, 'entry-a')]);
        idbControl.rejectGet = true;
        const tabA = await openTab({ hidden: true });

        await expect(tabA.started).resolves.toBe('failed');
        idbControl.rejectGet = false;
        const tabB = await openTab({ hidden: true });

        await expect(tabB.started).resolves.toBe('ok');
        tabA.page.show();
        await flush();
        expect(tabA.drain.outboxDrainState()).toBe('waiting');
        expect(isDrainHeld()).toBe(false);

        tabB.page.show();
        await vi.waitFor(() => expect(tabB.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
    });

    test('M2: hidden with a stalled request: after OUTBOX_HIDDEN_RELEASE_MS it is aborted and the lock released', async () => {
        const never = deferred();
        const ledger = serveLedger({ holds: [never] });

        await storeOutbox([storedOp(1, 'entry-a')]);
        const tabA = await openTab();

        await tabA.started;
        const tabB = await openTab();

        await tabB.started;
        await vi.waitFor(() => expect(ledger.requests).toHaveLength(1));
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        tabA.page.hide();
        await vi.advanceTimersByTimeAsync(tabA.drain.OUTBOX_HIDDEN_RELEASE_MS - 1);
        expect(tabA.drain.outboxDrainState()).toBe('holding');
        expect(ledger.aborted()).toEqual([false]);
        await vi.advanceTimersByTimeAsync(1);
        vi.useRealTimers();

        await vi.waitFor(() => expect(tabB.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a', 'POST entry-a']));
        expect(ledger.aborted()).toEqual([true, false]);
        expect(ledger.maxInFlight()).toBe(1);
    });

    test('L1: a repeated start of the client during a hidden release starts no session: one request at a time', async () => {
        const first = deferred();
        const ledger = serveLedger({ holds: [first] });

        await storeOutbox([storedOp(1, 'entry-a'), storedOp(2, 'entry-b')]);
        const tab = await openTab();

        await tab.started;
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        tab.page.hide();
        await tab.ledger.startLedgerOutbox(tab.client, USER, tab.effects);
        await flush();
        expect(ledger.requests).toEqual(['POST entry-a']);

        first.resolve();
        await vi.waitFor(() => expect(isDrainHeld()).toBe(false));
        tab.page.show();
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a', 'POST entry-b']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(ledger.maxInFlight()).toBe(1);
    });

    test('L6: hidden → visible while a request is in flight: the lock is taken again after the release and op-2 is sent', async () => {
        const first = deferred();
        const ledger = serveLedger({ holds: [first] });

        await storeOutbox([storedOp(1, 'entry-a'), storedOp(2, 'entry-b')]);
        const tab = await openTab();

        await tab.started;
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
        tab.page.hide();
        await flush();
        tab.page.show();
        first.resolve();

        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a', 'POST entry-b']));
        await vi.waitFor(async () => expect((await readOutboxKey())?.ops).toEqual([]));
        expect(tab.drain.outboxDrainState()).toBe('holding');
        expect(ledger.maxInFlight()).toBe(1);
    });

    test('L4: a removal from a drain session that is no longer current leaves the persisted versions', async () => {
        onlineManager.setOnline(false);
        await storeOutbox([updateOp(1, 'entry-x', 'v1'), updateOp(2, 'entry-x', 'v1')], {
            versions: { 'entry-x': 'v9' },
        });
        const tab = await openTab();

        await tab.started;
        const [op] = tab.store.pendingOutboxOps();

        if (!op) {
            throw new Error('no op');
        }
        const fence = tab.store.currentOutboxFence();

        tab.store.stopOutbox();
        tab.store.startOutbox(USER);
        tab.store.noteOutboxVersion(op, 'v2');
        await tab.store.removeOutboxOp(op, fence);

        const stored = await readOutboxKey();

        expect(stored?.ops.map(({ opId }) => opId)).toEqual(['op-2']);
        expect(stored?.versions).toEqual({ 'entry-x': 'v9' });
    });

    test('L5: the clear write on acquisition fails: the keys are read again before the adoption', async () => {
        const ledger = serveLedger();
        const tabB = await openTab();

        await tabB.started;
        const tabA = await openTab();

        await tabA.started;
        // Written by a tab whose ping was lost: A read an empty outbox.
        await storeOutbox([storedOp(1, 'entry-a')], {
            sending: { opId: 'op-1', session: 'dead-holder' },
        });
        let rejectClear = 1;

        idbControl.rejectSet = value => {
            if (rejectClear > 0 && isRemovalWrite(value)) {
                rejectClear -= 1;
                return true;
            }
            return false;
        };
        await tabB.drain.stopOutboxDrain();

        await vi.waitFor(() => expect(tabA.drain.outboxDrainState()).toBe('holding'));
        await vi.waitFor(() => expect(rejectClear).toBe(0));
        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
    });

    test('L5: a re-read that fails on a ping is tried again after a backoff', async () => {
        const ledger = serveLedger();
        const tab = await openTab();

        await tab.started;
        await storeOutbox([storedOp(1, 'entry-a')]);
        const ping = new BroadcastChannel(`chipin-outbox:${USER}`);

        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        idbControl.rejectGet = true;
        ping.postMessage({ type: 'changed' });
        await vi.waitFor(() => expect(idbControl.rejectedGets).toBeGreaterThan(0));
        idbControl.rejectGet = false;
        await vi.advanceTimersByTimeAsync(1_000);
        vi.useRealTimers();
        ping.close();

        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
    });

    test('N7: a Retry of an op of another owner is not requested', async () => {
        await storeFailed(storedOp(1, 'entry-x', { owner: 'user-2' }));
        await storeOutbox([], { nextSeq: 2 });
        const tab = await openTab();

        await tab.started;
        await expect(tab.drain.retryOutboxOps(['op-1'])).resolves.toEqual([]);
        expect((await readOutboxKey())?.retryRequested).toEqual([]);
    });

    test('N2: a sync that throws does not stop the next ones', async () => {
        const ledger = serveLedger();
        const tab = await openTab();

        await tab.started;
        const ping = new BroadcastChannel(`chipin-outbox:${USER}`);
        const cache = vi.spyOn(tab.client, 'getMutationCache').mockImplementationOnce(() => {
            throw new Error('adoption failed');
        });

        await storeOutbox([storedOp(1, 'entry-a')]);
        ping.postMessage({ type: 'changed' });
        await vi.waitFor(() => expect(cache).toHaveBeenCalled());
        await flush();
        ping.postMessage({ type: 'changed' });
        ping.close();

        await vi.waitFor(() => expect(ledger.requests).toEqual(['POST entry-a']));
    });

    test('N3: a write listener that throws does not turn a landed write into a rejection', async () => {
        onlineManager.setOnline(false);
        const tab = await openTab();

        await tab.started;
        const remove = tab.store.onOutboxWritten(() => {
            throw new Error('listener failed');
        });

        await expect(queueCreate(tab)).resolves.toBeUndefined();
        remove();
        expect(tab.store.pendingOutboxOps()).toHaveLength(1);
    });
});
