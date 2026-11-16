// The outbox queue (spec 03 §2.3), one tab, in memory (03-15a). Every change of the queue goes
// through `writeOutbox`, the stand-in for the write-locked read-modify-write of the persisted keys
// (03-15b: IndexedDB, 03-15c: Web Locks); the rest is the drain tab's memory: `cancelledOpIds`,
// `pendingRemovals`, `outboxVersions`, the statuses and the op being sent.
import { outboxGate } from './outboxGate';

export type OutboxKind = 'createExpense' | 'updateExpense' | 'deleteExpense';

/** The fields every op carries (§2.1); the kinds add their payload (`entities/ledger`). */
export interface OutboxOpBase {
    readonly opId: string;
    /** The queue order everywhere (C2-16); `createdAt` is only for `stale` (§2.8). */
    readonly seq: number;
    /** The `userId` of the outbox owner, checked before every send (§2.3). */
    readonly owner: string;
    readonly entryKind: 'expense';
    readonly createdAt: number;
    readonly schema: 1;
    readonly kind: OutboxKind;
    readonly entryId: string;
}

/**
 * Why an op failed (§2.5). `conflict`: a 409 `LEDGER.VERSION_CONFLICT` until 03-16b turns it into
 * a conflict draft. `rejected`: any other final answer, or a write that could not be built.
 */
export type FailedReason =
    | 'validation'
    | 'forbidden'
    | 'deletedRemotely'
    | 'idConflict'
    | 'conflict'
    | 'rejected'
    | 'unreadable';

export interface FailedOp {
    readonly op: OutboxOpBase;
    readonly reason: FailedReason;
    readonly failedAt: number;
}

export type OutboxStatus =
    | 'waiting-network'
    | 'server-unavailable'
    | 'sign-in-required'
    | 'update-required'
    | 'failed-unsaved';

/** The future persisted `OutboxState` (§2.3): pending `ops` by `seq`, failed ops, cancellations. */
interface OutboxState {
    nextSeq: number;
    ops: OutboxOpBase[];
    failed: Map<string, FailedOp>;
    cancelled: Set<string>;
}

const emptyState = (): OutboxState => ({
    nextSeq: 1,
    ops: [],
    failed: new Map(),
    cancelled: new Set(),
});

let state = emptyState();
let ownerId: string | null = null;
let running = false;
let sendingOpId: string | null = null;
const outboxVersions = new Map<string, string>();
const pendingRemovals = new Set<string>();
const cancelledOpIds = new Set<string>();
const statusByOpId = new Map<string, OutboxStatus>();
// Entries whose failed-list write is still pending: their block must stay (D29).
const failureWrites = new Map<string, number>();

const forgetMemory = (): void => {
    state = emptyState();
    sendingOpId = null;
    outboxVersions.clear();
    pendingRemovals.clear();
    cancelledOpIds.clear();
    statusByOpId.clear();
    failureWrites.clear();
};

/** The tab starts draining the outbox of `userId`; another user's queue is dropped from memory. */
export const startOutbox = (userId: string): void => {
    if (ownerId !== userId) {
        forgetMemory();
        outboxGate.reset();
        ownerId = userId;
    }
    running = true;
};

const wakeListeners = new Set<() => void>();

/** A run waiting for the network or a backoff re-checks a stop or its cancellation on a wake. */
export const onOutboxWake = (listener: () => void): (() => void) => {
    wakeListeners.add(listener);
    return () => {
        wakeListeners.delete(listener);
    };
};

const wake = (): void => {
    [...wakeListeners].forEach(listener => listener());
    outboxGate.wake();
};

/** The drain stops (logout, user change): every waiting run resolves `STOPPED` without a request. */
export const stopOutbox = (): void => {
    running = false;
    wake();
    outboxGate.reset();
    // Every waiting run has resolved: no cancellation is needed any more.
    cancelledOpIds.clear();
    state.cancelled.clear();
};

/** Tests only: no owner, an empty queue. */
export const resetOutbox = (): void => {
    stopOutbox();
    forgetMemory();
    ownerId = null;
};

export const outboxOwner = (): string | null => ownerId;

/** `isStopped()` of §2.4: this tab does not drain now. */
export const isOutboxStopped = (): boolean => !running;

/** One read-modify-write of the queue; rejects when the write fails (never in memory). */
export const writeOutbox = <T>(change: (draft: OutboxState) => T): Promise<T> =>
    Promise.resolve().then(() => change(state));

/** Appends the op that `build` makes with the next `seq` (C2-16). */
export const appendOutboxOp = <Op extends OutboxOpBase>(build: (seq: number) => Op): Promise<Op> =>
    writeOutbox(draft => {
        const op = build(draft.nextSeq);

        draft.nextSeq += 1;
        draft.ops.push(op);
        return op;
    });

/** The pending ops by `seq`. */
export const pendingOutboxOps = (): readonly OutboxOpBase[] =>
    [...state.ops].sort((a, b) => a.seq - b.seq);

export const failedOutboxOps = (): readonly FailedOp[] => [...state.failed.values()];

export const isOpFailed = (opId: string): boolean => state.failed.has(opId);

/** The entries with a pending or failed op (§1.4 `outboxState.entryIds`). */
export const outboxEntryIds = (): ReadonlySet<string> =>
    new Set(
        [...state.ops, ...[...state.failed.values()].map(({ op }) => op)].map(op => op.entryId),
    );

const hasOtherOpOf = (entryId: string, opId: string): boolean =>
    state.ops.some(op => op.entryId === entryId && op.opId !== opId);

/** An unsent create of the entry (a sent one, still waiting for its removal, has a version). */
export const hasPendingCreateOf = (entryId: string): boolean =>
    state.ops.some(
        op =>
            op.entryId === entryId && op.kind === 'createExpense' && !pendingRemovals.has(op.opId),
    );

/** Our latest write of the entry, newer than any `baseVersion` (§2.1). */
export const getOutboxVersion = (entryId: string): string | null =>
    outboxVersions.get(entryId) ?? null;

/** After a success: the version is kept only while later ops of the entry still need it. */
export const noteOutboxVersion = (op: OutboxOpBase, version: string | null): void => {
    if (version !== null && hasOtherOpOf(op.entryId, op.opId)) {
        outboxVersions.set(op.entryId, version);
    } else {
        outboxVersions.delete(op.entryId);
    }
};

export const markPendingRemoval = (opId: string): void => {
    pendingRemovals.add(opId);
};

export const isPendingRemoval = (opId: string): boolean => pendingRemovals.has(opId);

/** A sent op leaves the queue (and the failed list, after a Retry). */
export const removeOutboxOp = (op: OutboxOpBase): Promise<void> =>
    writeOutbox(draft => {
        draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
        draft.failed.delete(op.opId);
        pendingRemovals.delete(op.opId);
    });

/** Counts a failed-list write of the entry until it lands (or is given up). */
export const trackFailureWrite = <T>(entryId: string, write: Promise<T>): Promise<T> => {
    failureWrites.set(entryId, (failureWrites.get(entryId) ?? 0) + 1);
    return write.finally(() => {
        const left = (failureWrites.get(entryId) ?? 1) - 1;

        if (left > 0) {
            failureWrites.set(entryId, left);
        } else {
            failureWrites.delete(entryId);
        }
    });
};

/** No failed op of the entry, landed or still being written: its later ops may go. */
export const hasNoFailureOf = (entryId: string): boolean =>
    !failureWrites.has(entryId) &&
    ![...state.failed.values()].some(({ op }) => op.entryId === entryId);

/** A final answer: the op moves from the queue to the failed list (§2.5). */
export const recordFailedOp = (op: OutboxOpBase, reason: FailedReason): Promise<void> =>
    writeOutbox(draft => {
        draft.failed.set(op.opId, { op, reason, failedAt: Date.now() });
        draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
    });

export const isOpCancelled = (opId: string): boolean => cancelledOpIds.has(opId);

/** The op's run settled: its cancellation is no longer needed (§2.5). */
export const forgetCancelled = (opId: string): Promise<void> =>
    writeOutbox(draft => {
        draft.cancelled.delete(opId);
        cancelledOpIds.delete(opId);
    });

export const setOutboxStatus = (opId: string, status: OutboxStatus): void => {
    statusByOpId.set(opId, status);
};

export const outboxStatus = (opId: string): OutboxStatus | undefined => statusByOpId.get(opId);

/** The op whose request is going out (the `sending` claim of §2.3, one tab). */
export const claimOutboxOp = (opId: string | null): void => {
    sendingOpId = opId;
};

export interface DiscardResult {
    discarded: string[];
    /** Being sent, or sent and waiting for its removal: the server has (or will have) it. */
    refused: string[];
}

/**
 * Cancels ops (C2-15/C3-04): one write removes them from the queue and the failed list and
 * records them as cancelled; a waiting run resolves `CANCELLED` without a request. A failed
 * create is discarded together with the ops of its entry by the caller (`opIds`).
 */
export const discardOps = (opIds: readonly string[]): Promise<DiscardResult> =>
    writeOutbox(draft => {
        const isSent = (opId: string): boolean => opId === sendingOpId || pendingRemovals.has(opId);
        const refused = opIds.filter(isSent);
        const discarded: string[] = [];
        const entries = new Set<string>();

        opIds.forEach(opId => {
            const pending = draft.ops.find(op => op.opId === opId);
            const op = pending ?? draft.failed.get(opId)?.op;

            if (!op || isSent(opId)) {
                return;
            }
            discarded.push(opId);
            entries.add(op.entryId);
            draft.failed.delete(opId);
            // Only a pending op has a run that must resolve `CANCELLED`; it forgets the id.
            if (pending) {
                draft.cancelled.add(opId);
                cancelledOpIds.add(opId);
            }
        });
        draft.ops = draft.ops.filter(({ opId }) => !discarded.includes(opId));
        return { discarded, refused, entries };
    }).then(({ discarded, refused, entries }) => {
        entries.forEach(entryId => {
            if (hasNoFailureOf(entryId)) {
                outboxGate.unblock(entryId);
            }
        });
        wake();
        return { discarded, refused };
    });
