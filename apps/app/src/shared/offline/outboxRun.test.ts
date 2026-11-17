import { onlineManager, QueryClient } from '@tanstack/react-query';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiResponseFormatError, AuthRequestCancelledError } from 'shared/api/client';
import { ApiError } from 'shared/lib/apiError';

import { outboxGate } from './outboxGate';
import {
    adoptOutboxOps,
    classifyOutboxError,
    type OutboxDeps,
    OutboxEntryGoneError,
    type OutboxErrorClass,
    type OutboxResult,
    OutboxTerminalError,
    recheckOutboxOwner,
    retryWrite,
    runOutboxOp,
} from './outboxRun';
import {
    appendOutboxOp,
    discardOps,
    failedOutboxOps,
    getOutboxVersion,
    markPendingRemoval,
    noteOutboxVersion,
    type OutboxKind,
    type OutboxOpBase,
    pendingOutboxOps,
    readOutbox,
    recordFailedOp,
    removeOutboxOp,
    requestRetry,
    resetOutbox,
    restoreOutboxVersions,
    startOutbox,
    stopOutbox,
    writeOutbox,
} from './outboxStore';
import { isEntryWithPendingOp } from './pendingOps';

vi.mock('./queryPersister', () => ({ reportPersistFailed: vi.fn() }));
// The outbox keys in memory: the queue writes are real read-modify-writes, without IndexedDB timers.
vi.mock('idb-keyval', () => {
    const store = new Map<string, unknown>();

    return {
        get: (key: string) => Promise.resolve(store.get(key)),
        set: (key: string, value: unknown) => {
            store.set(key, value);
            return Promise.resolve();
        },
        del: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
        clear: () => {
            store.clear();
            return Promise.resolve();
        },
    };
});
// The queue writes stay real; a test can make one fail or hang (the IndexedDB writes of 03-15b).
vi.mock('./outboxStore', async importOriginal => {
    const actual = await importOriginal<typeof import('./outboxStore')>();

    return {
        ...actual,
        recordFailedOp: vi.fn(actual.recordFailedOp),
        removeOutboxOp: vi.fn(actual.removeOutboxOp),
    };
});

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

const OWNER = 'user-1';

const apiError = (status: number, code?: string): ApiError =>
    new ApiError({ status, payload: code ? { code } : undefined, cause: null });

// What Axios rejects with when no response came (`isAxiosError`, no `response`).
const networkError = (): Error =>
    Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });

const queue = (
    entryId: string,
    kind: OutboxKind = 'updateExpense',
    { owner = OWNER, createdAt = Date.now() }: { owner?: string; createdAt?: number } = {},
): Promise<OutboxOpBase> =>
    appendOutboxOp(seq => ({
        opId: `op-${seq}`,
        seq,
        owner,
        entryKind: 'expense',
        createdAt,
        schema: 1,
        kind,
        entryId,
    }));

interface Harness {
    deps: OutboxDeps<OutboxOpBase>;
    /** `opId` of every request, in order. */
    sent: string[];
    /** The `knownVersion` each request was sent with. */
    versions: (string | null)[];
    maxInFlight: () => number;
}

// `answer(op, attempt)` gives the response of each request: a version, or an error to throw.
const harness = (
    answer: (op: OutboxOpBase, attempt: number) => string | Error = op => `v-${op.opId}`,
    sessionUserId: () => string | null = () => OWNER,
): Harness => {
    const sent: string[] = [];
    const versions: (string | null)[] = [];
    const attempts = new Map<string, number>();
    let inFlight = 0;
    let maxInFlight = 0;

    return {
        sent,
        versions,
        maxInFlight: () => maxInFlight,
        deps: {
            sessionUserId,
            send: (op, knownVersion) => {
                const attempt = attempts.get(op.opId) ?? 0;

                attempts.set(op.opId, attempt + 1);
                sent.push(op.opId);
                versions.push(knownVersion);
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        inFlight -= 1;
                        const result = answer(op, attempt);

                        if (result instanceof Error) {
                            reject(result);
                        } else {
                            resolve({ version: result, entry: { id: op.entryId } });
                        }
                    }, 10);
                });
            },
        },
    };
};

type Settled = OutboxResult | OutboxTerminalError;

// Runs the ops like their adopted mutations: all adopted first, started in reverse order.
const runAll = (
    ops: readonly OutboxOpBase[],
    deps: OutboxDeps<OutboxOpBase>,
): Promise<Settled>[] => {
    ops.forEach(op => outboxGate.adopt(op));
    return [...ops]
        .reverse()
        .map(op =>
            runOutboxOp(op, deps).catch((error: unknown) =>
                error instanceof OutboxTerminalError ? error : Promise.reject(error),
            ),
        )
        .reverse();
};

const tick = (ms = 1_000): Promise<void> => vi.advanceTimersByTimeAsync(ms).then(() => undefined);

beforeEach(async () => {
    vi.useFakeTimers();
    resetOutbox();
    await clear();
    // This tab holds the drain lock (03-15c2: `readOutbox` alone does not drain).
    startOutbox(OWNER);
    await readOutbox(OWNER);
});

afterEach(() => {
    resetOutbox();
    onlineManager.setOnline(true);
    vi.useRealTimers();
});

describe('03 §2.4 order and gate', () => {
    test('C2-16: ops go out one at a time in seq order, even with the device clock set back', async () => {
        const ops = [
            await queue('entry-x', 'createExpense', { createdAt: 3_000 }),
            await queue('entry-x', 'updateExpense', { createdAt: 2_000 }),
            await queue('entry-y', 'deleteExpense', { createdAt: 1_000 }),
        ];
        const { deps, sent, maxInFlight } = harness();
        const results = Promise.all(runAll(ops, deps));

        await tick();
        expect(sent).toEqual(['op-1', 'op-2', 'op-3']);
        expect(maxInFlight()).toBe(1);
        await expect(results).resolves.toEqual(
            ops.map(op => ({ kind: 'sent', entry: { id: op.entryId } })),
        );
        expect(pendingOutboxOps()).toEqual([]);
    });

    test('03 §2.1: the second write of an entry carries the version of the first one (outboxVersions)', async () => {
        const ops = [
            await queue('entry-x', 'createExpense'),
            await queue('entry-x'),
            await queue('entry-x'),
        ];
        const { deps, versions } = harness();
        const results = Promise.all(runAll(ops, deps));

        await tick();
        await results;
        expect(versions).toEqual([null, 'v-op-1', 'v-op-2']);
        // No op of the entry is left: its version is not kept.
        expect(getOutboxVersion('entry-x')).toBeNull();
    });

    test('D29: a failed op of entry X blocks only the later ops of X; entry Y keeps draining', async () => {
        const ops = [await queue('entry-x'), await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness(op =>
            op.opId === 'op-1' ? apiError(422, 'VALIDATION.INVALID') : `v-${op.opId}`,
        );
        const [first, , third] = runAll(ops, deps);

        await tick();
        await expect(first).resolves.toEqual(new OutboxTerminalError('validation'));
        await expect(third).resolves.toMatchObject({ kind: 'sent' });
        expect(sent).toEqual(['op-1', 'op-3']);
        expect(outboxGate.isBlocked('entry-x')).toBe(true);
        expect(failedOutboxOps()).toEqual([
            { op: ops[0], reason: 'validation', failedAt: expect.any(Number) },
        ]);
        expect(pendingOutboxOps()).toEqual([ops[1]]);
    });

    test('03 §2.5: 426 closes the global gate: the op stays pending and no other entry goes out', async () => {
        const ops = [await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness((op, attempt) =>
            op.opId === 'op-1' && attempt === 0 ? apiError(426, 'CLIENT.OUTDATED') : 'v',
        );
        const results = Promise.all(runAll(ops, deps));

        await tick(60_000);
        expect(sent).toEqual(['op-1']);
        expect(outboxGate.isClosed('outdated')).toBe(true);
        expect(failedOutboxOps()).toEqual([]);

        outboxGate.open('outdated');
        await tick();
        expect(sent).toEqual(['op-1', 'op-1', 'op-2']);
        await expect(results).resolves.toMatchObject([{ kind: 'sent' }, { kind: 'sent' }]);
    });

    test.each<[string, Error]>([
        ['401 after a failed refresh', apiError(401, 'AUTH.UNAUTHORIZED')],
        // H1: the interceptor found no token, another user's token, or a changed session.
        ['an interceptor-cancelled request', new AuthRequestCancelledError(true)],
    ])(
        '03 §2.5 row 401: %s closes the auth gate, the op stays pending (not failed) and no other entry goes out',
        async (_name, error) => {
            const ops = [await queue('entry-x'), await queue('entry-y')];
            const { deps, sent } = harness((op, attempt) =>
                op.opId === 'op-1' && attempt === 0 ? error : 'v',
            );
            const results = Promise.all(runAll(ops, deps));

            await tick(60_000);
            expect(sent).toEqual(['op-1']);
            expect(outboxGate.isClosed('auth')).toBe(true);
            expect(failedOutboxOps()).toEqual([]);
            expect(outboxGate.isBlocked('entry-x')).toBe(false);

            recheckOutboxOwner(OWNER);
            await tick();
            expect(sent).toEqual(['op-1', 'op-1', 'op-2']);
            await expect(results).resolves.toMatchObject([{ kind: 'sent' }, { kind: 'sent' }]);
        },
    );

    test('03 §2.4: an op of a blocked entry waits until the entry is unblocked, the others pass it', async () => {
        const ops = [await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness();

        outboxGate.block('entry-x');
        const [first] = runAll(ops, deps);

        await tick();
        expect(sent).toEqual(['op-2']);
        outboxGate.unblock('entry-x');
        await tick();
        expect(sent).toEqual(['op-2', 'op-1']);
        await expect(first).resolves.toMatchObject({ kind: 'sent' });
    });

    test('03 §2.5: 5xx and 409 SYSTEM.CONFLICT are retried with backoff; the op never fails', async () => {
        const [op] = [await queue('entry-x')];
        const { deps, sent } = harness((_op, attempt) =>
            attempt === 0
                ? apiError(503)
                : attempt === 1
                  ? apiError(409, 'SYSTEM.CONFLICT')
                  : 'v-2',
        );
        const result = runOutboxOp(op, deps);

        await tick(100);
        expect(sent).toHaveLength(1);
        await tick(10_000);
        await expect(result).resolves.toMatchObject({ kind: 'sent' });
        expect(sent).toHaveLength(3);
        expect(failedOutboxOps()).toEqual([]);
    });

    test('03 §2.5: network errors while online are retried spaced by backoff, not in a tight loop', async () => {
        const [op] = [await queue('entry-x')];
        const { deps, sent } = harness((_op, attempt) => (attempt < 3 ? networkError() : 'v'));
        const result = runOutboxOp(op, deps);

        await tick(500);
        expect(sent).toHaveLength(1);
        await tick(60_000);
        await expect(result).resolves.toMatchObject({ kind: 'sent' });
        expect(sent).toHaveLength(4);
    });

    test('03 §2.4: offline the op waits for the network without a request', async () => {
        const [op] = [await queue('entry-x')];
        const { deps, sent } = harness();

        onlineManager.setOnline(false);
        const result = runOutboxOp(op, deps);

        await tick(60_000);
        expect(sent).toEqual([]);
        onlineManager.setOnline(true);
        await tick();
        await expect(result).resolves.toMatchObject({ kind: 'sent' });
    });

    test('03 §2.4: a stopped drain resolves the waiting runs as stopped, the ops stay queued', async () => {
        const ops = [await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness();

        onlineManager.setOnline(false);
        const results = Promise.all(runAll(ops, deps));

        await tick();
        stopOutbox();
        await expect(results).resolves.toEqual([{ kind: 'stopped' }, { kind: 'stopped' }]);
        expect(sent).toEqual([]);
        expect(pendingOutboxOps()).toEqual(ops);
    });
});

describe('03 §2.5 error classes', () => {
    test.each<[string, unknown, OutboxKind, OutboxErrorClass]>([
        ['network error', networkError(), 'createExpense', { kind: 'network' }],
        ['500', apiError(500), 'updateExpense', { kind: 'transient' }],
        [
            '409 SYSTEM.CONFLICT',
            apiError(409, 'SYSTEM.CONFLICT'),
            'updateExpense',
            { kind: 'transient' },
        ],
        ['401', apiError(401), 'updateExpense', { kind: 'auth' }],
        [
            'interceptor cancel (H1)',
            new AuthRequestCancelledError(),
            'createExpense',
            { kind: 'auth' },
        ],
        ['429', apiError(429), 'updateExpense', { kind: 'transient' }],
        [
            '2xx with a non-JSON body',
            new ApiResponseFormatError(201),
            'createExpense',
            { kind: 'transient' },
        ],
        [
            'cancelled request',
            Object.assign(new Error('canceled'), { __CANCEL__: true }),
            'createExpense',
            { kind: 'transient' },
        ],
        [
            '410 with another code',
            apiError(410, 'GONE'),
            'createExpense',
            { kind: 'final', reason: 'rejected' },
        ],
        [
            '409 unknown code',
            apiError(409, 'OTHER'),
            'updateExpense',
            { kind: 'final', reason: 'rejected' },
        ],
        ['426', apiError(426, 'CLIENT.OUTDATED'), 'createExpense', { kind: 'outdated' }],
        ['400', apiError(400), 'createExpense', { kind: 'final', reason: 'validation' }],
        ['422', apiError(422), 'updateExpense', { kind: 'final', reason: 'validation' }],
        ['403', apiError(403), 'deleteExpense', { kind: 'final', reason: 'forbidden' }],
        ['404 PATCH', apiError(404), 'updateExpense', { kind: 'final', reason: 'deletedRemotely' }],
        ['404 DELETE', apiError(404), 'deleteExpense', { kind: 'noop' }],
        [
            '410 duplicate create',
            apiError(410, 'LEDGER.ENTRY_DELETED'),
            'createExpense',
            { kind: 'noop' },
        ],
        [
            '409 ID_CONFLICT',
            apiError(409, 'LEDGER.ID_CONFLICT'),
            'createExpense',
            { kind: 'final', reason: 'idConflict' },
        ],
        [
            '409 VERSION_CONFLICT',
            apiError(409, 'LEDGER.VERSION_CONFLICT'),
            'updateExpense',
            { kind: 'final', reason: 'conflict' },
        ],
        [
            'unknown version, GET 404',
            new OutboxEntryGoneError(),
            'deleteExpense',
            { kind: 'final', reason: 'deletedRemotely' },
        ],
        [
            'not a request error',
            new Error('mapper'),
            'createExpense',
            { kind: 'final', reason: 'rejected' },
        ],
    ])('%s', (_name, error, kind, expected) => {
        expect(classifyOutboxError(error, kind)).toEqual(expected);
    });

    test('a DELETE answered 404 is a success: the op leaves the queue', async () => {
        const [op] = [await queue('entry-x', 'deleteExpense')];
        const { deps } = harness(() => apiError(404));
        const result = runOutboxOp(op, deps);

        await tick();
        await expect(result).resolves.toEqual({ kind: 'sent', entry: null });
        expect(pendingOutboxOps()).toEqual([]);
        expect(failedOutboxOps()).toEqual([]);
    });

    test('C3-05: a failing write of the failed list repeats only the write; the op stays pending and keeps the turn', async () => {
        const ops = [await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness(op => (op.opId === 'op-1' ? apiError(422) : 'v'));

        vi.mocked(recordFailedOp)
            .mockRejectedValueOnce(new Error('quota'))
            .mockRejectedValueOnce(new Error('quota'));
        const [first, second] = runAll(ops, deps);

        await tick(100);
        expect(sent).toEqual(['op-1']);
        expect(pendingOutboxOps()).toEqual(ops);
        expect(failedOutboxOps()).toEqual([]);
        await tick(1_000);
        // Still writing (backoff): entry Y waits for the turn, nothing is resent.
        expect(sent).toEqual(['op-1']);
        await tick(10_000);
        await expect(first).resolves.toEqual(new OutboxTerminalError('validation'));
        await expect(second).resolves.toMatchObject({ kind: 'sent' });
        expect(sent).toEqual(['op-1', 'op-2']);
        expect(recordFailedOp).toHaveBeenCalledTimes(3);
        expect(failedOutboxOps().map(({ op }) => op.opId)).toEqual(['op-1']);
    });

    test('03 §2.4: retryWrite gives up when the drain stops; the request is not repeated', async () => {
        const [op] = [await queue('entry-x')];
        const write = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('quota'));
        const landed = retryWrite(op, write);

        stopOutbox();
        await tick(10_000);
        await expect(landed).resolves.toBe(false);
        expect(write).toHaveBeenCalledTimes(1);
    });
});

describe('C2-15/C3-04 discard', () => {
    test('discarding the head: no request of it, the next op goes after it settled', async () => {
        const ops = [
            await queue('entry-a', 'createExpense'),
            await queue('entry-b', 'createExpense'),
        ];
        const { deps, sent, maxInFlight } = harness();

        onlineManager.setOnline(false);
        const results = Promise.all(runAll(ops, deps));

        await tick();
        await expect(discardOps(['op-1'])).resolves.toEqual({ discarded: ['op-1'], refused: [] });
        onlineManager.setOnline(true);
        await tick();
        await expect(results).resolves.toEqual([
            { kind: 'cancelled' },
            { kind: 'sent', entry: { id: 'entry-b' } },
        ]);
        expect(sent).toEqual(['op-2']);
        expect(maxInFlight()).toBe(1);
        expect(pendingOutboxOps()).toEqual([]);
    });

    test('an op whose request is going out cannot be discarded: the request completes normally', async () => {
        const [op] = [await queue('entry-a')];
        const { deps, sent } = harness();
        const result = runOutboxOp(op, deps);

        await tick(1);
        expect(sent).toEqual(['op-1']);
        await expect(discardOps(['op-1'])).resolves.toEqual({ discarded: [], refused: ['op-1'] });
        await tick();
        await expect(result).resolves.toMatchObject({ kind: 'sent' });
    });

    test('discarding during a backoff: no second request, the op resolves cancelled at once', async () => {
        const [op] = [await queue('entry-a')];
        const { deps, sent } = harness(() => apiError(503));
        const result = runOutboxOp(op, deps);

        await tick(100);
        expect(sent).toEqual(['op-1']);
        await expect(discardOps(['op-1'])).resolves.toEqual({ discarded: ['op-1'], refused: [] });
        await tick(1);
        await expect(result).resolves.toEqual({ kind: 'cancelled' });
        expect(vi.getTimerCount()).toBe(0);
        await tick(60_000);
        expect(sent).toEqual(['op-1']);
    });

    test('M3: a sent op waiting for its removal is not discarded, and a sent create is no longer a pending create', async () => {
        const removal = deferred();
        const [op] = [await queue('entry-a', 'createExpense')];
        const { deps } = harness();

        vi.mocked(removeOutboxOp).mockImplementationOnce((target, fence) =>
            removal.promise.then(() =>
                vi.mocked(removeOutboxOp).getMockImplementation()?.(target, fence),
            ),
        );
        const result = runOutboxOp(op, deps);

        await tick();
        await expect(result).resolves.toMatchObject({ kind: 'sent' });
        expect(pendingOutboxOps()).toEqual([op]);
        await expect(discardOps(['op-1'])).resolves.toEqual({ discarded: [], refused: ['op-1'] });
        // An edit appended now reads, under the write lock, that no create of the entry is queued.
        let hasPendingCreate: boolean | null = null;

        await appendOutboxOp((seq, view) => {
            hasPendingCreate = view.hasPendingCreateOf('entry-a');
            return { ...op, opId: `op-${seq}`, seq, kind: 'updateExpense' };
        });
        expect(hasPendingCreate).toBe(false);
        removal.resolve();
        await tick();
        expect(pendingOutboxOps().map(({ opId }) => opId)).toEqual(['op-2']);
    });

    test('discarding a failed create with its edits: no request for the entry, the entry is unblocked', async () => {
        const ops = [
            await queue('entry-c', 'createExpense'),
            await queue('entry-c'),
            await queue('entry-d', 'createExpense'),
        ];
        const { deps, sent } = harness(op => (op.opId === 'op-1' ? apiError(422) : 'v'));
        const [, edit, other] = runAll(ops, deps);

        await tick();
        expect(sent).toEqual(['op-1', 'op-3']);
        await expect(other).resolves.toMatchObject({ kind: 'sent' });

        await discardOps(['op-1', 'op-2']);
        await tick();
        await expect(edit).resolves.toEqual({ kind: 'cancelled' });
        expect(sent).toEqual(['op-1', 'op-3']);
        expect(outboxGate.isBlocked('entry-c')).toBe(false);
        expect(failedOutboxOps()).toEqual([]);
        expect(pendingOutboxOps()).toEqual([]);
    });
});

test('D29 M4: a success does not unblock its entry; only a Retry of the failed op does', async () => {
    const removal = deferred();
    const ops = [await queue('entry-x'), await queue('entry-x'), await queue('entry-x')];
    const { deps, sent } = harness((op, attempt) =>
        op.opId === 'op-2' && attempt === 0 ? apiError(422) : `v-${op.opId}`,
    );

    // The removal of op-1 lands only after op-2 failed.
    vi.mocked(removeOutboxOp).mockImplementationOnce((target, fence) =>
        removal.promise.then(() =>
            vi.mocked(removeOutboxOp).getMockImplementation()?.(target, fence),
        ),
    );
    const [, second, third] = runAll(ops, deps);

    await tick();
    await expect(second).resolves.toEqual(new OutboxTerminalError('validation'));
    removal.resolve();
    await tick(60_000);
    expect(sent).toEqual(['op-1', 'op-2']);
    expect(outboxGate.isBlocked('entry-x')).toBe(true);

    // Retry: the failed op takes its turn by seq, its success unblocks the entry, op-3 follows.
    const [failed] = failedOutboxOps();

    await requestRetry(failed ? [failed.op.opId] : [], () => true);
    const retried = failed ? runOutboxOp(failed.op, deps) : null;

    await tick();
    await expect(retried).resolves.toMatchObject({ kind: 'sent' });
    await expect(third).resolves.toMatchObject({ kind: 'sent' });
    expect(sent).toEqual(['op-1', 'op-2', 'op-2', 'op-3']);
    expect(outboxGate.isBlocked('entry-x')).toBe(false);
});

describe('03 §2.3 owner check (C3-07)', () => {
    test("M1: after an account switch the previous owner's runs stop without touching the new owner's queue", async () => {
        let session: string | null = OWNER;
        const [stale] = [await queue('entry-x')];
        const { deps, sent } = harness(undefined, () => session);

        onlineManager.setOnline(false);
        const staleRun = runOutboxOp(stale, deps);

        await tick();
        session = 'user-2';
        startOutbox('user-2');
        await readOutbox('user-2');
        const own = await queue('entry-y', 'createExpense', { owner: 'user-2' });
        const ownRun = runOutboxOp(own, deps);

        onlineManager.setOnline(true);
        await tick();
        await expect(staleRun).resolves.toEqual({ kind: 'stopped' });
        await expect(ownRun).resolves.toMatchObject({ kind: 'sent' });
        expect(sent).toEqual([own.opId]);
        expect(outboxGate.isClosed('auth')).toBe(false);
        expect(failedOutboxOps()).toEqual([]);
    });

    test("an op is never sent with another user's token: the auth gate waits for the owner", async () => {
        let session: string | null = 'user-2';
        const ops = [await queue('entry-x'), await queue('entry-y')];
        const { deps, sent } = harness(undefined, () => session);
        const results = Promise.all(runAll(ops, deps));

        await tick(60_000);
        expect(sent).toEqual([]);
        expect(outboxGate.isClosed('auth')).toBe(true);

        recheckOutboxOwner('user-2');
        await tick();
        expect(sent).toEqual([]);

        session = OWNER;
        recheckOutboxOwner(OWNER);
        await tick();
        expect(sent).toEqual(['op-1', 'op-2']);
        await expect(results).resolves.toMatchObject([{ kind: 'sent' }, { kind: 'sent' }]);
    });

    test("R2-L1 §2.3: a stale run's late answer does not clear the new owner's claim; its in-flight op cannot be discarded", async () => {
        let session: string | null = OWNER;
        const answers = new Map<string, Deferred>();
        const deps: OutboxDeps<OutboxOpBase> = {
            sessionUserId: () => session,
            send: op => {
                const answer = deferred();

                answers.set(op.opId, answer);
                return answer.promise.then(() => ({ version: 'v', entry: null }));
            },
        };
        const stale = await queue('entry-x');
        const staleRun = runOutboxOp(stale, deps);

        await tick(1);
        expect([...answers.keys()]).toEqual([stale.opId]);

        session = 'user-2';
        startOutbox('user-2');
        await readOutbox('user-2');
        const own = await appendOutboxOp(seq => ({
            opId: 'op-of-user-2',
            seq,
            owner: 'user-2',
            entryKind: 'expense',
            createdAt: 1_000,
            schema: 1,
            kind: 'createExpense',
            entryId: 'entry-y',
        }));
        const ownRun = runOutboxOp(own, deps);

        await tick(1);
        expect([...answers.keys()]).toEqual([stale.opId, own.opId]);
        answers.get(stale.opId)?.resolve();
        await expect(staleRun).resolves.toEqual({ kind: 'stopped' });

        await expect(discardOps([own.opId])).resolves.toEqual({
            discarded: [],
            refused: [own.opId],
        });
        answers.get(own.opId)?.resolve();
        await expect(ownRun).resolves.toMatchObject({ kind: 'sent' });
    });

    test("adoption moves an op of another owner to failed 'unreadable' and never sends it", async () => {
        const client = new QueryClient();
        const { deps, sent } = harness();

        client.setMutationDefaults<OutboxResult, Error, OutboxOpBase>(['outbox'], {
            mutationFn: op => runOutboxOp(op, deps),
            networkMode: 'always',
            retry: false,
        });
        const foreign = await queue('entry-x', 'createExpense', { owner: 'user-2' });
        const own = await queue('entry-y', 'createExpense');

        adoptOutboxOps(
            client,
            () => ['outbox'],
            () => true,
        );
        // Idempotent: a repeated adoption does not duplicate the running mutation.
        adoptOutboxOps(
            client,
            () => ['outbox'],
            () => true,
        );
        await tick();
        expect(sent).toEqual([own.opId]);
        expect(client.getMutationCache().getAll()).toHaveLength(1);
        expect(failedOutboxOps()).toEqual([
            { op: foreign, reason: 'unreadable', failedAt: expect.any(Number) },
        ]);
    });
});

test('03 §1.4 C2-08: an entry with a pending or failed op is not persisted', async () => {
    expect(isEntryWithPendingOp(['ledger', 'entry', 'entry-x'])).toBe(false);
    await queue('entry-x');
    expect(isEntryWithPendingOp(['ledger', 'entry', 'entry-x'])).toBe(true);
    expect(isEntryWithPendingOp(['ledger', 'entry', 'entry-y'])).toBe(false);
    expect(isEntryWithPendingOp(['groups', 'entry', 'entry-x'])).toBe(false);
});

test('03-15b L3: the restore takes the persisted versions, except of an entry whose sent op waits for its removal', async () => {
    const first = await queue('entry-x');

    await queue('entry-x');
    await writeOutbox(draft => {
        draft.versions.set('entry-x', 'v-persisted');
    });
    restoreOutboxVersions();
    expect(getOutboxVersion('entry-x')).toBe('v-persisted');

    // The first op was sent (in-memory version), its removal write is still pending.
    noteOutboxVersion(first, 'v-newer');
    markPendingRemoval(first.opId);
    restoreOutboxVersions();
    expect(getOutboxVersion('entry-x')).toBe('v-newer');
});

test('03-15c1 R1 N3: a mutation of an older drain session failing before its run keeps the newer session turn', async () => {
    const hold = deferred();
    const [first] = [await queue('entry-a')];
    const client = new QueryClient();

    client.setMutationDefaults(['test', 'outbox'], {
        mutationFn: () =>
            hold.promise.then(() => Promise.reject(new Error('failed before its run'))),
        networkMode: 'always',
        retry: false,
    });
    adoptOutboxOps(
        client,
        () => ['test', 'outbox'],
        () => true,
    );
    // The drain stops and starts again: the new session adopts op-1 again, op-2 waits behind it.
    stopOutbox();
    startOutbox(OWNER);
    const second = await queue('entry-b');
    let hasTurn = false;

    outboxGate.adopt(first);
    void outboxGate.whenTurn(second).then(() => {
        hasTurn = true;
    });
    hold.resolve();
    await tick(10);
    expect(hasTurn).toBe(false);
});
