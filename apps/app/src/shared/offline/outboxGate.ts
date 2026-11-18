// The outbox send gate and drain turn (spec 03 §2.4), in the draining tab's memory: the global
// reasons (`close`/`open`), the per-entry block (`block`/`unblock`) and `whenTurn`, the single send
// slot. The slot goes to the adopted op with the lowest `seq` whose entry is not blocked, once no
// global reason is closed; the op keeps it until its run settles (`releaseTurn`). Whether an op
// may be sent is never read from storage.

export type OutboxGateReason = 'auth' | 'outdated';

/** What the turn order needs of an op. */
export interface OutboxTurnOp {
    opId: string;
    seq: number;
    entryId: string;
}

export interface WhenTurnOptions {
    /** A failed op under "Retry" takes its turn by its `seq`, ignoring its entry's block. */
    ignoreEntryBlock?: boolean;
    /** A cancelled or stopped op leaves its wait at once without the slot: it sends nothing. */
    isSkipped?: () => boolean;
}

interface Adopted {
    seq: number;
    entryId: string;
    ignoreEntryBlock: boolean;
}

interface Waiter {
    isSkipped: (() => boolean) | undefined;
    resolve: () => void;
}

const closed = new Set<OutboxGateReason>();
const blocked = new Set<string>();
const adopted = new Map<string, Adopted>();
const waiters = new Map<string, Waiter>();
let holder: string | null = null;

const isEligible = ({ entryId, ignoreEntryBlock }: Adopted): boolean =>
    ignoreEntryBlock || !blocked.has(entryId);

// The adopted eligible op with the lowest `seq`. An op whose run has not reached the gate yet
// still holds back the ops after it.
const nextInTurn = (): string | null => {
    let next: string | null = null;
    let nextSeq = Infinity;

    adopted.forEach((op, opId) => {
        if (isEligible(op) && op.seq < nextSeq) {
            next = opId;
            nextSeq = op.seq;
        }
    });
    return next;
};

const pump = (): void => {
    waiters.forEach((waiter, opId) => {
        if (waiter.isSkipped?.() === true) {
            waiters.delete(opId);
            waiter.resolve();
        }
    });
    if (closed.size > 0) {
        return;
    }
    const next = holder ?? nextInTurn();
    const waiter = next === null ? undefined : waiters.get(next);

    if (next !== null && waiter) {
        waiters.delete(next);
        holder = next;
        waiter.resolve();
    }
};

const adopt = ({ opId, seq, entryId }: OutboxTurnOp, ignoreEntryBlock: boolean): void => {
    adopted.set(opId, { seq, entryId, ignoreEntryBlock });
};

export const outboxGate = {
    close: (reason: OutboxGateReason): void => {
        closed.add(reason);
    },
    open: (reason: OutboxGateReason): void => {
        closed.delete(reason);
        pump();
    },
    isClosed: (reason: OutboxGateReason): boolean => closed.has(reason),
    /** Later ops of the entry are skipped (its op failed, §2.5); other entries keep draining. */
    block: (entryId: string): void => {
        blocked.add(entryId);
        pump();
    },
    unblock: (entryId: string): void => {
        blocked.delete(entryId);
        pump();
    },
    isBlocked: (entryId: string): boolean => blocked.has(entryId),
    blockedEntryIds: (): string[] => [...blocked],
    /**
     * An adopted op joins the turn order before its run starts (adoption is by `seq`); a failed op
     * under "Retry" ignores its entry's block.
     */
    adopt: (op: OutboxTurnOp, ignoreEntryBlock = false): void => {
        if (!adopted.has(op.opId)) {
            adopt(op, ignoreEntryBlock);
        }
    },
    /** Resolves once `op` holds the send slot (again, after a retry), or at once when skipped. */
    whenTurn: (op: OutboxTurnOp, options: WhenTurnOptions = {}): Promise<void> =>
        new Promise<void>(resolve => {
            adopt(op, options.ignoreEntryBlock ?? adopted.get(op.opId)?.ignoreEntryBlock ?? false);
            waiters.set(op.opId, { isSkipped: options.isSkipped, resolve });
            pump();
        }),
    /** The op's run settled (or only its removal write is left): the next op gets the slot. */
    releaseTurn: (opId: string): void => {
        adopted.delete(opId);
        waiters.delete(opId);
        if (holder === opId) {
            holder = null;
        }
        pump();
    },
    /** Re-evaluates the waiting ops: after a discard a cancelled op leaves its wait. */
    wake: (): void => {
        pump();
    },
    /** The drain stopped (user change) or a test: every waiting run resumes and sees the stop. */
    reset: (): void => {
        const pending = [...waiters.values()];

        closed.clear();
        blocked.clear();
        adopted.clear();
        waiters.clear();
        holder = null;
        pending.forEach(waiter => waiter.resolve());
    },
};

export type OutboxGate = typeof outboxGate;
