// The outbox queue (spec 03 §2.3), one tab (03-15b). The queue is the persisted keys
// `chipin:outbox:<userId>` (`OutboxState`) and `chipin:outbox-failed:<userId>`: every change goes
// through `writeOutbox`, one read-modify-write of both keys in the order of `runOutboxIo` (03-15c
// wraps it in the write lock). `state` is the last state this tab read or wrote, for the synchronous
// readers. The rest is the drain tab's memory: `cancelledOpIds`, `pendingRemovals`,
// `outboxVersions`, the statuses and the op being sent.
import * as Sentry from '@sentry/react';
import { get, set } from 'idb-keyval';

import { outboxFailedKey, outboxStateKey } from './constants';
import { outboxGate } from './outboxGate';
import { onOutboxDisposed, OutboxWriteStoppedError, reviveOutboxIo, runOutboxIo } from './outboxIo';
import {
    type FAILED_REASONS,
    FailedKeySchema,
    FailedOpSchema,
    type OUTBOX_KINDS,
    OutboxOpBaseSchema,
    OutboxStateSchema,
    type PersistedOutboxState,
    RetryRequestedSchema,
    SendingSchema,
    VersionsSchema,
} from './outboxSchema';
import { persistCodec } from './persistCodec';

export type OutboxKind = (typeof OUTBOX_KINDS)[number];

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
 * `unreadable`: not a readable op of this owner. `stale`: older than 14 days (§2.8).
 */
export type FailedReason = (typeof FAILED_REASONS)[number];

export interface FailedOp {
    readonly op: OutboxOpBase;
    readonly reason: FailedReason;
    readonly failedAt: number;
}

/** A failed record whose op is not readable as an op: kept as it was read. */
interface UnreadableRecord {
    readonly record: unknown;
    readonly entryId: string | null;
}

export type OutboxStatus =
    | 'waiting-network'
    | 'server-unavailable'
    | 'sign-in-required'
    | 'update-required'
    | 'failed-unsaved';

/** `outboxRestore` of §1.6: this tab's first read of the owner's keys. */
export type OutboxRestore = 'pending' | 'ok' | 'failed';

/** The persisted outbox of the owner, as `writeOutbox` changes it. */
export interface OutboxState {
    nextSeq: number;
    /** Pending, by `seq`. */
    ops: OutboxOpBase[];
    failed: Map<string, FailedOp>;
    unreadable: UnreadableRecord[];
    cancelled: Set<string>;
    versions: Map<string, string>;
    retryRequested: string[];
    sending: PersistedOutboxState['sending'];
    conflictDrafts: unknown;
    /** Keys of a newer build: kept and written back. */
    unknownFields: Record<string, unknown>;
}

/** §2.8: at most this many pending and failed ops per user. */
export const OUTBOX_LIMIT = 50;

/** The append was refused: the outbox holds `OUTBOX_LIMIT` ops (nothing was written). */
export class OutboxLimitError extends Error {
    override readonly name = 'OutboxLimitError';

    constructor() {
        super('The outbox is full');
    }
}

/** The append write was rejected (quota, private mode): the op does not exist (§2.8). */
export class OutboxPersistError extends Error {
    override readonly name = 'OutboxPersistError';
    /** What the IndexedDB write rejected with. */
    readonly writeError: unknown;

    constructor(writeError: unknown) {
        super('The outbox op could not be saved');
        this.writeError = writeError;
    }
}

const emptyState = (): OutboxState => ({
    nextSeq: 1,
    ops: [],
    failed: new Map(),
    unreadable: [],
    cancelled: new Set(),
    versions: new Map(),
    retryRequested: [],
    sending: null,
    conflictDrafts: {},
    unknownFields: {},
});

const bySeq = (a: OutboxOpBase, b: OutboxOpBase): number => a.seq - b.seq;

const stringField = (value: unknown, field: string): string | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const fieldValue: unknown = Reflect.get(value, field);

    return typeof fieldValue === 'string' ? fieldValue : null;
};

// Stored values are `persistCodec` strings; anything else makes the key unreadable.
const parseStored = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        throw new TypeError('The outbox key is not a string');
    }
    return persistCodec.parse(value);
};

// Throws when a key is unreadable as a whole (`outboxRestore = 'failed'`, the key is kept). An
// op that is not readable moves to failed `unreadable`; an op both pending and failed is failed
// (C3-05: a crash between the two writes of a move to failed).
const recordOp = (record: unknown): unknown =>
    typeof record === 'object' && record !== null ? Reflect.get(record, 'op') : null;

// An auxiliary field held an invalid value: it was dropped (reported once per read, the queue keeps
// working). No value is sent.
const reportInvalidFields = (): void => {
    Sentry.captureMessage('outbox.invalid_field', { level: 'warning' });
};

const toState = (outboxValue: unknown, failedValue: unknown): OutboxState => {
    const state = emptyState();
    const persisted =
        outboxValue === undefined ? null : OutboxStateSchema.parse(parseStored(outboxValue));
    const records =
        failedValue === undefined ? [] : FailedKeySchema.parse(parseStored(failedValue));
    const now = Date.now();

    records.forEach(record => {
        const parsed = FailedOpSchema.safeParse(record);
        const op = parsed.success ? OutboxOpBaseSchema.safeParse(parsed.data.op) : null;

        if (parsed.success && op?.success) {
            state.failed.set(op.data.opId, {
                op: op.data,
                reason: parsed.data.reason,
                failedAt: parsed.data.failedAt,
            });
        } else {
            // Also a reason this build does not know (a newer one wrote it): its entry stays blocked.
            state.unreadable.push({ record, entryId: stringField(recordOp(record), 'entryId') });
        }
    });
    if (!persisted) {
        return state;
    }
    // An unreadable op already moved to failed (a crash before the `ops` write) is not added twice.
    const unreadableOpIds = new Set(
        state.unreadable.flatMap(({ record }) => stringField(recordOp(record), 'opId') ?? []),
    );

    persisted.ops.forEach(raw => {
        const op = OutboxOpBaseSchema.safeParse(raw);
        const rawOpId = stringField(raw, 'opId');

        if (!op.success && rawOpId !== null && unreadableOpIds.has(rawOpId)) {
            return;
        }
        if (!op.success) {
            state.unreadable.push({
                record: { op: raw, reason: 'unreadable', failedAt: now },
                entryId: stringField(raw, 'entryId'),
            });
        } else if (!state.failed.has(op.data.opId)) {
            state.ops.push(op.data);
        }
    });
    state.ops.sort(bySeq);
    state.nextSeq = Math.max(persisted.nextSeq, ...state.ops.map(op => op.seq + 1));
    const {
        nextSeq: _nextSeq,
        ops: _ops,
        versions,
        cancelled,
        retryRequested,
        sending,
        conflictDrafts,
        ...unknownFields
    } = persisted;
    const versionEntries = Object.entries(VersionsSchema.catch({}).parse(versions ?? {}));
    const validVersions = versionEntries.flatMap(([entryId, version]): [string, string][] =>
        typeof version === 'string' ? [[entryId, version]] : [],
    );
    const parsedSending = SendingSchema.safeParse(sending ?? null);
    const parsedRetries = RetryRequestedSchema.safeParse(retryRequested ?? []);

    if (
        !VersionsSchema.safeParse(versions ?? {}).success ||
        validVersions.length !== versionEntries.length ||
        !parsedSending.success ||
        !parsedRetries.success
    ) {
        reportInvalidFields();
    }
    state.versions = new Map(validVersions);
    state.cancelled = new Set(cancelled);
    state.retryRequested = parsedRetries.success ? parsedRetries.data : [];
    state.sending = parsedSending.success ? parsedSending.data : null;
    state.conflictDrafts = conflictDrafts ?? {};
    state.unknownFields = unknownFields;
    return state;
};

const entryIdsOf = (draft: OutboxState): Set<string> =>
    new Set(
        [...draft.ops, ...[...draft.failed.values()].map(({ op }) => op)].map(op => op.entryId),
    );

const toPersisted = (draft: OutboxState): PersistedOutboxState => {
    const entries = entryIdsOf(draft);

    return {
        ...draft.unknownFields,
        nextSeq: draft.nextSeq,
        ops: [...draft.ops].sort(bySeq),
        // A version is kept only while an op of its entry is left.
        versions: Object.fromEntries([...draft.versions].filter(([id]) => entries.has(id))),
        cancelled: [...draft.cancelled],
        retryRequested: draft.retryRequested,
        sending: draft.sending,
        conflictDrafts: draft.conflictDrafts,
    };
};

const toFailedRecords = (draft: OutboxState): unknown[] => [
    ...[...draft.failed.values()].map(({ op, reason, failedAt }) => ({ op, reason, failedAt })),
    ...draft.unreadable.map(({ record }) => record),
];

const EMPTY_OUTBOX_TEXT = persistCodec.stringify(toPersisted(emptyState()));
const EMPTY_FAILED_TEXT = persistCodec.stringify([]);

interface ReadKeys {
    state: OutboxState;
    outboxText: unknown;
    failedText: unknown;
}

const readKeys = (userId: string): Promise<ReadKeys> =>
    Promise.all([get<unknown>(outboxStateKey(userId)), get<unknown>(outboxFailedKey(userId))]).then(
        ([outboxText, failedText]) => ({
            state: toState(outboxText, failedText),
            outboxText,
            failedText,
        }),
    );

// Only a changed key is written, the failed key first (C3-05): after a crash between the two
// writes the op is in both, and failed wins on the next read.
const writeKeys = (userId: string, draft: OutboxState, read: ReadKeys): Promise<void> => {
    const failedText = persistCodec.stringify(toFailedRecords(draft));
    const outboxText = persistCodec.stringify(toPersisted(draft));
    const writeFailed =
        failedText === (read.failedText ?? EMPTY_FAILED_TEXT)
            ? Promise.resolve()
            : set(outboxFailedKey(userId), failedText);

    return writeFailed.then(() =>
        outboxText === (read.outboxText ?? EMPTY_OUTBOX_TEXT)
            ? undefined
            : set(outboxStateKey(userId), outboxText),
    );
};

// `DOMException` (the IDB errors) is not an `Error` in every realm: read its `name` directly.
const errorName = (error: unknown): string => stringField(error, 'name') ?? typeof error;

let state = emptyState();
let ownerId: string | null = null;
let running = false;
let restoreState: OutboxRestore = 'pending';
let restoring: Promise<OutboxRestore> | null = null;
// §2.8: an append write was rejected; offline writing stays off until the app restarts.
let persistFailedThisSession = false;
let sendingOpId: string | null = null;
const outboxVersions = new Map<string, string>();
const pendingRemovals = new Set<string>();
const cancelledOpIds = new Set<string>();
const statusByOpId = new Map<string, OutboxStatus>();
// Entries whose failed-list write is still pending: their block must stay (D29).
const failureWrites = new Map<string, number>();

const forgetMemory = (): void => {
    state = emptyState();
    restoreState = 'pending';
    restoring = null;
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
        reviveOutboxIo(userId);
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
    // Every waiting run has resolved: no cancellation is needed any more (the persisted list is
    // cleared by the runs' `forgetCancelled`).
    cancelledOpIds.clear();
};

/** Tests only: no owner, an empty queue, a new session. */
export const resetOutbox = (): void => {
    stopOutbox();
    forgetMemory();
    ownerId = null;
    persistFailedThisSession = false;
};

// `clearUserData` of the owner: the drain stops and the queue is forgotten (its keys are deleted).
onOutboxDisposed(userId => {
    if (ownerId === userId) {
        stopOutbox();
        forgetMemory();
        ownerId = null;
    }
});

export const outboxOwner = (): string | null => ownerId;

/** `isStopped()` of §2.4: this tab does not drain now. */
export const isOutboxStopped = (): boolean => !running;

/**
 * `readOutbox` of §1.6: this tab's first read and validation of both keys of `userId`, once per
 * owner; sets `outboxRestore`. No timeout. An IDB error or a key unreadable as a whole →
 * `failed` (the key is kept, Sentry `outbox.restore_failed`). Never rejects.
 */
export const readOutbox = (userId: string): Promise<OutboxRestore> => {
    startOutbox(userId);
    if (restoring) {
        return restoring;
    }
    const reading: Promise<OutboxRestore> = runOutboxIo(userId, () => readKeys(userId)).then(
        read => {
            if (restoring !== reading) {
                return 'pending';
            }
            state = read.state;
            restoreState = 'ok';
            return 'ok';
        },
        (error: unknown) => {
            if (restoring !== reading) {
                return 'pending';
            }
            restoreState = 'failed';
            Sentry.captureMessage('outbox.restore_failed', {
                level: 'warning',
                tags: { 'offline.error': errorName(error) },
            });
            return 'failed';
        },
    );

    restoring = reading;
    return reading;
};

/** `outboxRestore` of this tab for `userId`. */
export const outboxRestoreState = (userId: string): OutboxRestore =>
    ownerId === userId ? restoreState : 'pending';

/** §2.8: an append write failed in this session; offline writing is off until restart. */
export const isOutboxPersistFailed = (): boolean => persistFailedThisSession;

/**
 * One read-modify-write of both keys (§2.3), in this tab's IO order. Rejects when the write
 * fails (the change did not happen) and with `OutboxWriteStoppedError`, without a write, while
 * `outboxRestore !== 'ok'` (§1.6) or after the owner changed or was cleared. `change` changes only
 * the draft; the memory follows once the write has landed.
 */
export const writeOutbox = <T>(change: (draft: OutboxState) => T): Promise<T> => {
    const owner = ownerId;

    if (owner === null || restoreState !== 'ok') {
        return Promise.reject(new OutboxWriteStoppedError());
    }
    return runOutboxIo(owner, () =>
        readKeys(owner).then(read => {
            if (ownerId !== owner || restoreState !== 'ok') {
                throw new OutboxWriteStoppedError();
            }
            const result = change(read.state);

            return writeKeys(owner, read.state, read).then(() => {
                if (ownerId === owner) {
                    state = read.state;
                }
                return result;
            });
        }),
    );
};

const countOps = (draft: OutboxState): number =>
    draft.ops.length + draft.failed.size + draft.unreadable.length;

/** §2.8: the outbox holds `OUTBOX_LIMIT` pending and failed ops; no op is appended. */
export const isOutboxFull = (): boolean => countOps(state) >= OUTBOX_LIMIT;

/**
 * Appends the op that `build` makes with the next `seq` (C2-16), resolving once the write has
 * landed. Refused at the limit (`OutboxLimitError`). A rejected write (`OutboxPersistError`): the op
 * does not exist and offline writing is off until restart (§2.8, Sentry `outbox.persist_failed`).
 */
export const appendOutboxOp = <Op extends OutboxOpBase>(build: (seq: number) => Op): Promise<Op> =>
    writeOutbox(draft => {
        if (countOps(draft) >= OUTBOX_LIMIT) {
            throw new OutboxLimitError();
        }
        const op = build(draft.nextSeq);

        draft.nextSeq += 1;
        draft.ops.push(op);
        return op;
    }).catch((error: unknown) => {
        if (error instanceof OutboxLimitError || error instanceof OutboxWriteStoppedError) {
            throw error;
        }
        persistFailedThisSession = true;
        Sentry.captureMessage('outbox.persist_failed', {
            level: 'warning',
            tags: { 'offline.error': errorName(error) },
        });
        throw new OutboxPersistError(error);
    });

/** The pending ops by `seq`. */
export const pendingOutboxOps = (): readonly OutboxOpBase[] => [...state.ops].sort(bySeq);

export const failedOutboxOps = (): readonly FailedOp[] => [...state.failed.values()];

export const isOpFailed = (opId: string): boolean => state.failed.has(opId);

/** Discarded in the key (`OutboxState.cancelled`): a restore or an adoption skips it. */
export const isOpCancelledInKey = (opId: string): boolean => state.cancelled.has(opId);

const unreadableEntryIds = (): string[] =>
    state.unreadable.flatMap(({ entryId }) => (entryId === null ? [] : [entryId]));

/** The entries with a failed op (unreadable records with an entry id included). */
export const failedEntryIds = (): ReadonlySet<string> =>
    new Set([...[...state.failed.values()].map(({ op }) => op.entryId), ...unreadableEntryIds()]);

/** The entries with a pending or failed op (§1.4 `outboxState.entryIds`). */
export const outboxEntryIds = (): ReadonlySet<string> =>
    new Set([...entryIdsOf(state), ...unreadableEntryIds()]);

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

/**
 * Restore (§2.3): the persisted versions into memory, except for an entry whose sent op still
 * waits for its removal write (its in-memory version is newer).
 */
export const restoreOutboxVersions = (): void => {
    state.versions.forEach((version, entryId) => {
        const isRemoving = state.ops.some(
            op => op.entryId === entryId && pendingRemovals.has(op.opId),
        );

        if (!isRemoving) {
            outboxVersions.set(entryId, version);
        }
    });
};

export const markPendingRemoval = (opId: string): void => {
    pendingRemovals.add(opId);
};

export const isPendingRemoval = (opId: string): boolean => pendingRemovals.has(opId);

/**
 * A sent op leaves the queue (and the failed list, after a Retry); the same write keeps the
 * entry's version while another op of it is left (`OutboxState.versions`).
 */
export const removeOutboxOp = (op: OutboxOpBase): Promise<void> =>
    writeOutbox(draft => {
        draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
        draft.failed.delete(op.opId);
        const version = outboxVersions.get(op.entryId);

        if (version !== undefined && draft.ops.some(({ entryId }) => entryId === op.entryId)) {
            draft.versions.set(op.entryId, version);
        } else {
            draft.versions.delete(op.entryId);
        }
    }).then(() => {
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
    !failureWrites.has(entryId) && !failedEntryIds().has(entryId);

/** A final answer: the op moves from the queue to the failed list (§2.5), in one write. */
export const recordFailedOp = (op: OutboxOpBase, reason: FailedReason): Promise<void> =>
    writeOutbox(draft => {
        draft.failed.set(op.opId, { op, reason, failedAt: Date.now() });
        draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
    });

export const isOpCancelled = (opId: string): boolean => cancelledOpIds.has(opId);

/** The op's run settled: its cancellation is no longer needed (§2.5). */
export const forgetCancelled = (opId: string): Promise<void> => {
    cancelledOpIds.delete(opId);
    return writeOutbox(draft => {
        draft.cancelled.delete(opId);
    });
};

export const setOutboxStatus = (opId: string, status: OutboxStatus): void => {
    statusByOpId.set(opId, status);
};

export const outboxStatus = (opId: string): OutboxStatus | undefined => statusByOpId.get(opId);

/** Why a claim was refused: the drain stopped (or the owner changed), or the op left the queue. */
export type OutboxClaim = 'claimed' | 'stopped' | 'gone';

/**
 * The `sending` claim of §2.3 (one tab, in memory), taken in this tab's IO order: a discard whose
 * write is in flight lands first and the claim sees the op gone (`gone`: no request), or the claim
 * lands first and the discard refuses the op ("already sending"). A Retry claims a failed op.
 */
export const claimOutboxOp = (op: OutboxOpBase): Promise<OutboxClaim> =>
    runOutboxIo(op.owner, () => {
        if (!running || ownerId !== op.owner) {
            return Promise.resolve<OutboxClaim>('stopped');
        }
        const isQueued =
            state.ops.some(({ opId }) => opId === op.opId) || state.failed.has(op.opId);

        if (!isQueued || cancelledOpIds.has(op.opId) || state.cancelled.has(op.opId)) {
            return Promise.resolve<OutboxClaim>('gone');
        }
        sendingOpId = op.opId;
        return Promise.resolve<OutboxClaim>('claimed');
    }).catch((): OutboxClaim => 'stopped');

/** Clears the claim only while it is this op's: a stale run never clears a newer run's claim. */
export const releaseOutboxClaim = (opId: string): void => {
    if (sendingOpId === opId) {
        sendingOpId = null;
    }
};

export interface DiscardResult {
    discarded: string[];
    /** Being sent, or sent and waiting for its removal: the server has (or will have) it. */
    refused: string[];
}

/**
 * Cancels ops (C2-15/C3-04): one write removes them from the queue and the failed list and
 * records them as cancelled; once it has landed a waiting run resolves `CANCELLED` without a
 * request. A failed create is discarded together with the ops of its entry by the caller (`opIds`).
 */
export const discardOps = (opIds: readonly string[]): Promise<DiscardResult> =>
    writeOutbox(draft => {
        const isSent = (opId: string): boolean => opId === sendingOpId || pendingRemovals.has(opId);
        const refused = opIds.filter(isSent);
        const discarded: string[] = [];
        const pendingIds: string[] = [];
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
                pendingIds.push(opId);
            }
        });
        draft.ops = draft.ops.filter(({ opId }) => !discarded.includes(opId));
        return { discarded, refused, entries, pendingIds };
    }).then(({ discarded, refused, entries, pendingIds }) => {
        pendingIds.forEach(opId => cancelledOpIds.add(opId));
        entries.forEach(entryId => {
            if (hasNoFailureOf(entryId)) {
                outboxGate.unblock(entryId);
            }
        });
        wake();
        return { discarded, refused };
    });
