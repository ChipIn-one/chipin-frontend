// Sending the outbox (spec 03 §2.4, §2.5, D29): one op at a time in `seq` order, a failed op
// blocks only later ops of its own entry. `runOutboxOp` settles only with a success, a no-op
// result or a final error; everything else (no network, 5xx, the auth and outdated gates) waits
// inside it, holding the turn. It is the `mutationFn` of the outbox mutations (`retry: false`,
// `networkMode: 'always'`: the wait is here, not in the TanStack retryer; owner item 35).
import type { MutationKey, QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';

import {
    ApiResponseFormatError,
    AuthRequestCancelledError,
    isNetworkError,
    isRequestCancelled,
} from 'shared/api/client';
import { ApiError } from 'shared/lib/apiError';

import { outboxGate } from './outboxGate';
import {
    claimOutboxOp,
    type FailedReason,
    forgetCancelled,
    getOutboxVersion,
    hasNoFailureOf,
    isOpCancelled,
    isOpFailed,
    isOutboxStopped,
    isPendingRemoval,
    markPendingRemoval,
    noteOutboxVersion,
    onOutboxWake,
    type OutboxKind,
    type OutboxOpBase,
    outboxOwner,
    pendingOutboxOps,
    recordFailedOp,
    removeOutboxOp,
    setOutboxStatus,
    trackFailureWrite,
} from './outboxStore';
import { reportPersistFailed } from './queryPersister';

/** What a sent op answered: the entry's new version and the entry (both null for a delete). */
export interface OutboxSent {
    version: string | null;
    entry: unknown;
}

export type OutboxResult =
    | { kind: 'sent'; entry: unknown }
    /** The drain stopped: the op stays queued for the next drain. */
    | { kind: 'stopped' }
    /** Discarded: no request was sent. */
    | { kind: 'cancelled' };

const STOPPED: OutboxResult = { kind: 'stopped' };
const CANCELLED: OutboxResult = { kind: 'cancelled' };
const NO_OP: OutboxSent = { version: null, entry: null };

/** The op failed for good: it is in the failed list and its entry is blocked. */
export class OutboxTerminalError extends Error {
    override readonly name = 'OutboxTerminalError';
    readonly reason: FailedReason;

    constructor(reason: FailedReason) {
        super(`Outbox op failed: ${reason}`);
        this.reason = reason;
    }
}

/** An edit or a delete without a known version whose entry is gone (GET 404, §2.1). */
export class OutboxEntryGoneError extends Error {
    override readonly name = 'OutboxEntryGoneError';
}

export interface OutboxDeps<Op extends OutboxOpBase> {
    /** Sends one op; `knownVersion` is our latest write of the entry (§2.1), else null. */
    send: (op: Op, knownVersion: string | null) => Promise<OutboxSent>;
    /** The `sub` of the current access token (§2.3), compared with `op.owner` before each send. */
    sessionUserId: () => string | null;
}

export type OutboxErrorClass =
    | { kind: 'network' | 'transient' | 'auth' | 'outdated' | 'noop' }
    | { kind: 'final'; reason: FailedReason };

const final = (reason: FailedReason): OutboxErrorClass => ({ kind: 'final', reason });

const classifyStatus = ({ status, code }: ApiError, opKind: OutboxKind): OutboxErrorClass => {
    if (status >= 500 || status === 429 || (status === 409 && code === 'SYSTEM.CONFLICT')) {
        return { kind: 'transient' };
    }
    if (
        (status === 404 && opKind === 'deleteExpense') ||
        (status === 410 && opKind === 'createExpense' && code === 'LEDGER.ENTRY_DELETED')
    ) {
        return { kind: 'noop' };
    }
    switch (status) {
        case 401:
            return { kind: 'auth' };
        case 426:
            return { kind: 'outdated' };
        case 400:
        case 422:
            return final('validation');
        case 403:
            return final('forbidden');
        case 404:
            return final(opKind === 'updateExpense' ? 'deletedRemotely' : 'rejected');
        case 409:
            return code === 'LEDGER.VERSION_CONFLICT'
                ? final('conflict')
                : final(code === 'LEDGER.ID_CONFLICT' ? 'idConflict' : 'rejected');
        default:
            return final('rejected');
    }
};

/** The retry policy of §2.4/§2.5 for one failed send. */
export const classifyOutboxError = (error: unknown, opKind: OutboxKind): OutboxErrorClass => {
    if (error instanceof ApiError) {
        return classifyStatus(error, opKind);
    }
    if (error instanceof OutboxEntryGoneError) {
        return final('deletedRemotely');
    }
    // The interceptor refused the session (no token after a failed refresh, another user's token,
    // a session that changed meanwhile): pending behind the `auth` gate; a resend is idempotent.
    if (error instanceof AuthRequestCancelledError) {
        return { kind: 'auth' };
    }
    // A 2xx whose body was not JSON (the write was probably applied) or a cancelled request: retry.
    if (error instanceof ApiResponseFormatError || isRequestCancelled(error)) {
        return { kind: 'transient' };
    }
    return isNetworkError(error) ? { kind: 'network' } : final('rejected');
};

/** 1 s → 60 s, ±20 %. */
export const backoff = (attempt: number): number =>
    Math.min(1000 * 2 ** attempt, 60_000) * (0.8 + Math.random() * 0.4);

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

/**
 * Repeats a failed queue write with backoff until it lands (true) or `shouldStop` (false: the op
 * stays queued and the next drain sends it again, idempotent). The request is never repeated.
 */
export const retryWrite = (
    op: OutboxOpBase,
    write: () => Promise<unknown>,
    shouldStop: () => boolean = isOutboxStopped,
    attempt = 0,
): Promise<boolean> =>
    write().then(
        () => true,
        (error: unknown) => {
            setOutboxStatus(op.opId, 'failed-unsaved');
            reportPersistFailed(error);
            return sleep(backoff(attempt)).then(() =>
                shouldStop() ? false : retryWrite(op, write, shouldStop, attempt + 1),
            );
        },
    );

// A run of a previous owner (the tab switched accounts) is stopped: it never touches the state or
// the gate of the new owner (M1).
const isStale = (op: OutboxOpBase): boolean => isOutboxStopped() || op.owner !== outboxOwner();

const skipped = (op: OutboxOpBase): OutboxResult | null =>
    isStale(op) ? STOPPED : isOpCancelled(op.opId) ? CANCELLED : null;

const noop = (): void => undefined;

type StartWait = (done: () => void) => () => void;

// A wait for the network or a backoff ends early when the op is discarded or the drain stops
// (§2.5: a cancelled op resolves at the nearest check, without a request); either way the
// subscription and the timer are released.
const waitUnlessSkipped = (op: OutboxOpBase, start: StartWait): Promise<void> =>
    new Promise(resolve => {
        let settled = false;
        let stopWait = noop;
        let unsubscribe = noop;
        const finish = (): void => {
            if (!settled) {
                settled = true;
                stopWait();
                unsubscribe();
                resolve();
            }
        };

        if (skipped(op)) {
            finish();
            return;
        }
        unsubscribe = onOutboxWake(() => {
            if (skipped(op)) {
                finish();
            }
        });
        stopWait = start(finish);
        if (settled) {
            stopWait();
        }
    });

const online: StartWait = done => {
    if (onlineManager.isOnline()) {
        done();
        return noop;
    }
    return onlineManager.subscribe(isOnline => {
        if (isOnline) {
            done();
        }
    });
};

const timeout =
    (ms: number): StartWait =>
    done => {
        const timer = setTimeout(done, ms);

        return () => clearTimeout(timer);
    };

// A 2xx or a no-op answer: our version first, then the slot goes to the next op. The removal
// write needs no turn and keeps retrying after the drain stops, until the user changes. Only a
// Retry of a failed op (or a discard) unblocks an entry, never any other success (D29, M4).
const onSent = <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    sent: OutboxSent,
    isRetry: boolean,
): OutboxResult => {
    if (isStale(op)) {
        claimOutboxOp(null);
        return STOPPED;
    }
    noteOutboxVersion(op, sent.version);
    markPendingRemoval(op.opId);
    claimOutboxOp(null);
    outboxGate.releaseTurn(op.opId);
    void retryWrite(
        op,
        () => removeOutboxOp(op),
        () => deps.sessionUserId() !== op.owner,
    ).then(landed => {
        if (landed && isRetry && !isStale(op) && hasNoFailureOf(op.entryId)) {
            outboxGate.unblock(op.entryId);
        }
    });
    return { kind: 'sent', entry: sent.entry };
};

// The claim is cleared before a backoff or a gate wait (a discard is allowed meanwhile) and only
// after the failed-list write for a final answer (a discard never races it).
const onSendError = async <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    error: unknown,
    retry: () => Promise<OutboxResult>,
    { attempt, isRetry }: { attempt: number; isRetry: boolean },
): Promise<OutboxResult> => {
    if (isStale(op)) {
        claimOutboxOp(null);
        return STOPPED;
    }
    const errorClass = classifyOutboxError(error, op.kind);

    if (errorClass.kind === 'noop') {
        return onSent(op, deps, NO_OP, isRetry);
    }
    if (errorClass.kind !== 'final') {
        claimOutboxOp(null);
    }
    switch (errorClass.kind) {
        case 'network':
        case 'transient':
            setOutboxStatus(
                op.opId,
                errorClass.kind === 'network' ? 'waiting-network' : 'server-unavailable',
            );
            await waitUnlessSkipped(op, timeout(backoff(attempt)));
            return retry();
        case 'auth':
        case 'outdated':
            setOutboxStatus(
                op.opId,
                errorClass.kind === 'auth' ? 'sign-in-required' : 'update-required',
            );
            outboxGate.close(errorClass.kind);
            return retry();
        case 'final': {
            // Synchronously, before the write: later ops of this entry are skipped from now on.
            // The server answered for good: only the write is repeated, never the request.
            outboxGate.block(op.entryId);
            const landed = await trackFailureWrite(
                op.entryId,
                retryWrite(
                    op,
                    () => recordFailedOp(op, errorClass.reason),
                    () => isStale(op),
                ),
            );

            claimOutboxOp(null);
            if (!landed) {
                return STOPPED;
            }
            throw new OutboxTerminalError(errorClass.reason);
        }
    }
};

const attempt = async <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    ignoreEntryBlock: boolean,
    count: number,
): Promise<OutboxResult> => {
    const retry = (): Promise<OutboxResult> => attempt(op, deps, ignoreEntryBlock, count + 1);

    await outboxGate.whenTurn(op, { ignoreEntryBlock, isSkipped: () => skipped(op) !== null });
    await waitUnlessSkipped(op, online);
    const skip = skipped(op);

    if (skip) {
        return skip;
    }
    // C3-07, first check: the in-memory token. The interceptor repeats it against the token it
    // attaches (`expectedTokenSubject`), which a refresh may have replaced.
    if (deps.sessionUserId() !== op.owner) {
        setOutboxStatus(op.opId, 'sign-in-required');
        outboxGate.close('auth');
        return retry();
    }
    claimOutboxOp(op.opId);
    const outcome = await deps.send(op, getOutboxVersion(op.entryId)).then(
        (sent: OutboxSent) => ({ sent }),
        (error: unknown) => ({ error }),
    );

    return 'sent' in outcome
        ? onSent(op, deps, outcome.sent, ignoreEntryBlock)
        : onSendError(op, deps, outcome.error, retry, {
              attempt: count,
              isRetry: ignoreEntryBlock,
          });
};

/**
 * Sends one op when its turn comes. Resolves with a success, `stopped` or `cancelled`; rejects
 * only with `OutboxTerminalError`, after the op was recorded as failed.
 */
export const runOutboxOp = <Op extends OutboxOpBase>(
    op: Op,
    deps: OutboxDeps<Op>,
    { ignoreEntryBlock = false }: { ignoreEntryBlock?: boolean } = {},
): Promise<OutboxResult> =>
    attempt(op, deps, ignoreEntryBlock, 0).finally(() => {
        outboxGate.releaseTurn(op.opId);
        if (isOpCancelled(op.opId)) {
            void forgetCancelled(op.opId);
        }
    });

/**
 * Re-checks the owner (§2.3): the `auth` gate opens only while the token's `sub` is the outbox
 * owner. Called on a new access token (wired in 03-15b).
 */
export const recheckOutboxOwner = (sessionUserId: string | null): void => {
    const owner = outboxOwner();

    if (owner !== null && sessionUserId === owner) {
        outboxGate.open('auth');
    } else {
        outboxGate.close('auth');
    }
};

const opIdOf = (variables: unknown): unknown =>
    typeof variables === 'object' && variables !== null && 'opId' in variables
        ? variables.opId
        : undefined;

/** Whether the op may be sent for its owner (C3-07) and is an expense (C2-02). */
export type OutboxOpCheck = (op: OutboxOpBase) => boolean;

/**
 * Creates the outbox mutations (the only place, §2.1): each pending op not yet running, by `seq`,
 * as a paused mutation without a scope that continues at once (the drain turn orders them). An
 * op of another owner or not an expense moves to failed `unreadable`; skipped: cancelled, failed,
 * already sent (`pendingRemovals`) and already running ops (idempotent on a repeated call).
 */
export const adoptOutboxOps = (
    client: QueryClient,
    mutationKeyFor: (kind: OutboxKind) => MutationKey,
    isAcceptable: OutboxOpCheck,
): void => {
    const cache = client.getMutationCache();
    const running = new Set(
        cache
            .getAll()
            .filter(mutation => mutation.state.status === 'pending')
            .map(mutation => opIdOf(mutation.state.variables)),
    );

    pendingOutboxOps().forEach(op => {
        if (
            isOpCancelled(op.opId) ||
            isOpFailed(op.opId) ||
            isPendingRemoval(op.opId) ||
            running.has(op.opId)
        ) {
            return;
        }
        if (op.owner !== outboxOwner() || !isAcceptable(op)) {
            outboxGate.block(op.entryId);
            void retryWrite(op, () => recordFailedOp(op, 'unreadable'));
            return;
        }
        outboxGate.adopt(op);
        const mutation = cache.build<OutboxResult, Error, OutboxOpBase, unknown>(
            client,
            { mutationKey: mutationKeyFor(op.kind) },
            {
                context: undefined,
                data: undefined,
                error: null,
                failureCount: 0,
                failureReason: null,
                isPaused: true,
                status: 'pending',
                variables: op,
                submittedAt: op.createdAt,
            },
        );

        // Like `resumePausedMutations`: a final error is handled by the defaults' `onError`. A
        // mutation that failed before its run started must not hold the turn of the later ops (L4).
        void mutation.continue().catch(() => {
            outboxGate.releaseTurn(op.opId);
        });
    });
};
