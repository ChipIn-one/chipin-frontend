import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
    type OutboxKind,
    type OutboxOpBase,
    pendingOutboxOps,
    resetOutbox,
    startOutbox,
    stopOutbox,
} from './outboxStore';
import { isEntryWithPendingOp } from './pendingOps';

vi.mock('./queryPersister', () => ({ reportPersistFailed: vi.fn() }));

const OWNER = 'user-1';

const apiError = (status: number, code?: string): ApiError =>
    new ApiError({ status, payload: code ? { code } : undefined, cause: null });

// What Axios rejects with when no response came (`isAxiosError`, no `response`).
const networkError = (): Error =>
    Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });

const queue = (
    entryId: string,
    kind: OutboxKind = 'updateExpense',
    { owner = OWNER, createdAt = 1_000 }: { owner?: string; createdAt?: number } = {},
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

beforeEach(() => {
    vi.useFakeTimers();
    resetOutbox();
    startOutbox(OWNER);
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

    test('03 §2.5: 401 and 426 close the global gate: the op stays pending and no other entry goes out', async () => {
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

    test('C3-05: a failed write of the failed list repeats only the write, the request goes out once', async () => {
        const [op] = [await queue('entry-x')];
        const { deps, sent } = harness(() => apiError(422));
        const write = vi
            .fn<() => Promise<void>>()
            .mockRejectedValueOnce(new Error('quota'))
            .mockRejectedValueOnce(new Error('quota'))
            .mockResolvedValue(undefined);
        const landed = retryWrite(op, write);

        await tick(10_000);
        await expect(landed).resolves.toBe(true);
        expect(write).toHaveBeenCalledTimes(3);
        expect(sent).toEqual([]);

        const failed = expect(runOutboxOp(op, deps)).rejects.toEqual(
            new OutboxTerminalError('validation'),
        );

        await tick();
        await failed;
        expect(sent).toEqual(['op-1']);
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

describe('03 §2.3 owner check (C3-07)', () => {
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
