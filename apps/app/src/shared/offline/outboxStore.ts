// The outbox queue (spec 03 §2.3). The queue is the persisted keys `chipin:outbox:<userId>`
// (`OutboxState`) and `chipin:outbox-failed:<userId>`: every change goes through `writeOutbox`, one
// read-modify-write of both keys under the write lock (`runOutboxIo`, 03-15c1); a decision that
// depends on the queue (the claim, a pending create, whether an entry keeps its version) is taken
// from the draft read under that lock, never from memory. `state` is the last state this tab read
// or wrote, for the synchronous readers. The rest is the drain tab's memory: `cancelledOpIds`,
// `pendingRemovals`, `outboxVersions`, the statuses. A run carries the fence it started with
// (`OutboxFence`): the owner epoch (bumped by an owner change and by `clearUserData`) and the drain
// session (new at every start of the drain); its writes and gate calls are refused once it is stale.
import * as Sentry from '@sentry/react';
import { get, set } from 'idb-keyval';

import { outboxFailedKey, outboxStateKey } from './constants';
import { outboxGate } from './outboxGate';
import {
    onOutboxDisposed,
    OutboxLockTimeoutError,
    OutboxWriteStoppedError,
    reviveOutboxIo,
    runOutboxIo,
} from './outboxIo';
import {
    ConflictDraftSchema,
    ConflictDraftsSchema,
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
 * Why an op failed (§2.5). `conflict`: a 409 `LEDGER.VERSION_CONFLICT` recorded by 03-15a…03-16a
 * builds; the drain-lock restore turns it into a conflict draft (03-16b). `rejected`: any other final answer, or a write that could not be built.
 * `unreadable`: not a readable op of this owner. `stale`: older than 14 days (§2.8).
 */
export type FailedReason = (typeof FAILED_REASONS)[number];

export interface FailedOp {
    readonly op: OutboxOpBase;
    readonly reason: FailedReason;
    readonly failedAt: number;
}

/**
 * The user's changes of an entry the server answered 409 for (§2.6, D28): the merged wire patch of
 * the folded edits, never sent until the user saves it from the edit form.
 */
export interface ConflictDraft {
    readonly entryId: string;
    readonly groupId: string | null;
    /** The expense history the edits were made from (reopens the form). */
    readonly parentActivityId: string | null;
    /** The changed fields (`ExpensePatchWire` of `entities/ledger`), merged in `seq` order. */
    readonly fields: Readonly<Record<string, unknown>>;
    readonly createdAt: number;
}

/** A failed record whose op is not readable as an op: kept as it was read. */
interface UnreadableRecord {
    readonly record: unknown;
    readonly entryId: string | null;
}

export const OUTBOX_STATUSES = [
    'waiting-network',
    'server-unavailable',
    'sign-in-required',
    'update-required',
    'failed-unsaved',
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

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
    /** By entry id (§2.6). */
    conflictDrafts: Map<string, ConflictDraft>;
    /** Keys of a newer build: kept and written back. */
    unknownFields: Record<string, unknown>;
}

/** §2.8: at most this many pending and failed ops and conflict drafts per user. */
export const OUTBOX_LIMIT = 50;

/** The append was refused: the outbox holds `OUTBOX_LIMIT` ops (nothing was written). */
export class OutboxLimitError extends Error {
    override readonly name = 'OutboxLimitError';

    constructor() {
        super('The outbox is full');
    }
}

/**
 * The append write was rejected (quota, private mode) or its write lock timed out: the op does not
 * exist (§2.8). A lock timeout is transient (`isTransient`: the `saveRetry` toast, try again).
 */
export class OutboxPersistError extends Error {
    override readonly name = 'OutboxPersistError';
    /** What the IndexedDB write rejected with. */
    readonly writeError: unknown;
    readonly isTransient: boolean;

    constructor(writeError: unknown) {
        super('The outbox op could not be saved');
        this.writeError = writeError;
        this.isTransient = writeError instanceof OutboxLockTimeoutError;
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
    conflictDrafts: new Map(),
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

// Each draft is read on its own (like `versions`): a bad one is dropped, the key stays readable.
const readConflictDrafts = (
    value: unknown,
): { drafts: Map<string, ConflictDraft>; isValid: boolean } => {
    const parsed = ConflictDraftsSchema.safeParse(value ?? {});
    const drafts = new Map<string, ConflictDraft>();

    if (!parsed.success) {
        return { drafts, isValid: false };
    }
    let isValid = true;

    Object.entries(parsed.data).forEach(([entryId, raw]) => {
        const draft = ConflictDraftSchema.safeParse(raw);

        if (draft.success && draft.data.entryId === entryId) {
            drafts.set(entryId, {
                ...draft.data,
                parentActivityId: draft.data.parentActivityId ?? null,
            });
        } else {
            isValid = false;
        }
    });
    return { drafts, isValid };
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
    const drafts = readConflictDrafts(conflictDrafts);

    if (
        !VersionsSchema.safeParse(versions ?? {}).success ||
        validVersions.length !== versionEntries.length ||
        !parsedSending.success ||
        !parsedRetries.success ||
        !drafts.isValid
    ) {
        reportInvalidFields();
    }
    state.versions = new Map(validVersions);
    state.cancelled = new Set(cancelled);
    state.retryRequested = parsedRetries.success ? parsedRetries.data : [];
    state.sending = parsedSending.success ? parsedSending.data : null;
    state.conflictDrafts = drafts.drafts;
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
        conflictDrafts: Object.fromEntries(draft.conflictDrafts),
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
// writes the op is in both, and failed wins on the next read. A discard writes the outbox key
// first (`outboxFirst`, 03-15b R1 N2): a crash between the two leaves a discarded failed create
// failed, never its dependent edits pending without it.
const writeKeys = (
    userId: string,
    draft: OutboxState,
    read: ReadKeys,
    outboxFirst: boolean,
): Promise<void> => {
    const failedText = persistCodec.stringify(toFailedRecords(draft));
    const outboxText = persistCodec.stringify(toPersisted(draft));
    const writeFailed = (): Promise<void> =>
        failedText === (read.failedText ?? EMPTY_FAILED_TEXT)
            ? Promise.resolve()
            : set(outboxFailedKey(userId), failedText);
    const writeState = (): Promise<void> =>
        outboxText === (read.outboxText ?? EMPTY_OUTBOX_TEXT)
            ? Promise.resolve()
            : set(outboxStateKey(userId), outboxText);

    return outboxFirst ? writeState().then(writeFailed) : writeFailed().then(writeState);
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
// The fence (M2): `ownerEpoch` changes with the owner and at `clearUserData`, `drainSession` at
// every start of the drain. A run of an older fence never writes, claims or touches the gate.
let ownerEpoch = 0;
let drainSession = '';
// Aborts the requests of the drain session (§2.3: a release on freeze/pagehide aborts the one in flight).
let drainAbort = new AbortController();
const outboxVersions = new Map<string, string>();
const pendingRemovals = new Set<string>();
const cancelledOpIds = new Set<string>();
const statusByOpId = new Map<string, OutboxStatus>();
// M3: the appends of an entry not landed yet. While one is, a sent op's removal keeps the entry's
// version (the op being appended may be an edit or a delete based on an older cached version).
const appendsInFlight = new Map<string, number>();
const statusListeners = new Set<(opId: string, status: OutboxStatus) => void>();
const writeListeners = new Set<() => void>();
// Entries whose failed-list write is still pending: their block must stay (D29).
const failureWrites = new Map<string, number>();

// The UI's view of the queue (03-16a part B, `useOutboxOverlay`): told whenever what it reads
// changed (a write landed, a re-read, the restore, the owner, a status). No listener, no work.
const changeListeners = new Set<() => void>();
let changeRevision = 0;

/** Tells the overlay its view changed; a failing listener is reported, never thrown. */
export const notifyOutboxChange = (): void => {
    changeRevision += 1;
    changeListeners.forEach(listener => {
        try {
            listener();
        } catch (error: unknown) {
            Sentry.captureException(error);
        }
    });
};

export const onOutboxChange = (listener: () => void): (() => void) => {
    changeListeners.add(listener);
    return () => {
        changeListeners.delete(listener);
    };
};

/** Grows with every `notifyOutboxChange`: the overlay rebuilds its view only when it moved. */
export const outboxChangeRevision = (): number => changeRevision;

const forgetMemory = (): void => {
    state = emptyState();
    restoreState = 'pending';
    restoring = null;
    outboxVersions.clear();
    pendingRemovals.clear();
    cancelledOpIds.clear();
    statusByOpId.clear();
    appendsInFlight.clear();
    failureWrites.clear();
    notifyOutboxChange();
};

/** What a run started with: the owner epoch and the drain session (M2). */
export interface OutboxFence {
    readonly epoch: number;
    readonly session: string;
}

export const currentOutboxFence = (): OutboxFence => ({ epoch: ownerEpoch, session: drainSession });

/** The run's owner data still exists: no owner change and no `clearUserData` since it started. */
export const isOwnerFence = (fence: OutboxFence): boolean =>
    ownerId !== null && fence.epoch === ownerEpoch;

/** The run belongs to this tab's current drain: not stopped, not restarted, same owner data. */
export const isDrainFence = (fence: OutboxFence): boolean =>
    running && isOwnerFence(fence) && fence.session === drainSession;

/** The tab's outbox is `userId`'s (it may append and read); another user's queue is dropped from memory. */
export const bindOutboxOwner = (userId: string): void => {
    if (ownerId !== userId) {
        forgetMemory();
        outboxGate.reset();
        ownerId = userId;
        ownerEpoch += 1;
        reviveOutboxIo(userId);
        running = false;
    }
};

/**
 * The tab starts draining the outbox of `userId` (it took the drain lock, §2.3). A start after a
 * stop (or of another owner) opens a new drain session: the runs of the previous one are stale. A
 * start while the drain runs changes nothing.
 */
export const startOutbox = (userId: string): void => {
    bindOutboxOwner(userId);
    if (!running) {
        drainSession = crypto.randomUUID();
        drainAbort = new AbortController();
    }
    running = true;
};

/** Aborted when the drain is released on freeze/pagehide: the session's requests take it. */
export const outboxSessionSignal = (): AbortSignal => drainAbort.signal;

/** §2.3: a release on freeze/pagehide aborts the request in flight first. */
export const abortOutboxSends = (): void => {
    drainAbort.abort();
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

/**
 * The drain stops (the drain lock is released, logout, user change): every waiting run resolves
 * `STOPPED` without a request.
 */
export const stopOutbox = (): void => {
    running = false;
    wake();
    outboxGate.reset();
    // The cancellations stay: each run forgets its own when it settles (`forgetCancelled`).
};

/** Tests only: no owner, an empty queue, a new session. */
export const resetOutbox = (): void => {
    stopOutbox();
    forgetMemory();
    ownerId = null;
    ownerEpoch += 1;
    persistFailedThisSession = false;
};

// `clearUserData` of the owner: the drain stops and the queue is forgotten (its keys are deleted).
onOutboxDisposed(userId => {
    if (ownerId === userId) {
        stopOutbox();
        forgetMemory();
        ownerId = null;
        ownerEpoch += 1;
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
    bindOutboxOwner(userId);
    if (restoring) {
        return restoring;
    }
    // A write-lock timeout is transient (§2.3): the read is retried and `outboxRestore` stays
    // `pending` meanwhile; only an IDB error or an unreadable key fails the restore.
    const read = (attempt: number): Promise<ReadKeys> =>
        runOutboxIo(userId, () => readKeys(userId)).catch((error: unknown) => {
            if (!(error instanceof OutboxLockTimeoutError) || restoring !== reading) {
                throw error;
            }
            // Once per restore: it stays `pending` while the lock is contended.
            if (attempt === 0) {
                Sentry.captureMessage('outbox.write_lock_timeout', { level: 'warning' });
            }
            return new Promise<void>(resolve => {
                setTimeout(resolve, Math.min(1000 * 2 ** attempt, 30_000));
            }).then(() => read(attempt + 1));
        });
    const reading: Promise<OutboxRestore> = read(0).then(
        read => {
            if (restoring !== reading) {
                return 'pending';
            }
            state = read.state;
            restoreState = 'ok';
            notifyOutboxChange();
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
            notifyOutboxChange();
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
 * Whose write it is: a run passes its fence; `drain` also needs its drain session current.
 * `outboxFirst`: the outbox key is written before the failed key (a discard, N2).
 */
export interface OutboxWriteGuard {
    fence?: OutboxFence;
    drain?: boolean;
    outboxFirst?: boolean;
}

/**
 * One read-modify-write of both keys (§2.3) under the write lock. Rejects when the write fails
 * (the change did not happen) and with `OutboxWriteStoppedError`, without a write, while
 * `outboxRestore !== 'ok'` (§1.6), after the owner changed or was cleared since the call (or since
 * the guard's fence), and for a `drain` write once its drain session is stale; checked again once
 * the lock is held. `change` changes only the draft; the memory follows once the write has landed.
 */
export const writeOutbox = <T>(
    change: (draft: OutboxState) => T,
    { fence = currentOutboxFence(), drain = false, outboxFirst = false }: OutboxWriteGuard = {},
): Promise<T> => {
    const owner = ownerId;
    const isAllowed = (): boolean =>
        ownerId === owner &&
        restoreState === 'ok' &&
        isOwnerFence(fence) &&
        (!drain || isDrainFence(fence));

    if (owner === null || !isAllowed()) {
        return Promise.reject(new OutboxWriteStoppedError());
    }
    return runOutboxIo(owner, () =>
        readKeys(owner).then(read => {
            if (!isAllowed()) {
                throw new OutboxWriteStoppedError();
            }
            const result = change(read.state);

            return writeKeys(owner, read.state, read, outboxFirst).then(() => {
                if (ownerId === owner && isOwnerFence(fence)) {
                    state = read.state;
                    // The write landed: a failing listener must not turn it into a rejection.
                    writeListeners.forEach(listener => {
                        try {
                            listener();
                        } catch (error: unknown) {
                            Sentry.captureException(error);
                        }
                    });
                    notifyOutboxChange();
                }
                return result;
            });
        }),
    );
};

/** Called after every write of this tab landed (the `changed` ping, §2.3). */
export const onOutboxWritten = (listener: () => void): (() => void) => {
    writeListeners.add(listener);
    return () => {
        writeListeners.delete(listener);
    };
};

/**
 * Re-reads both keys under the write lock (a `changed` ping, the drain lock, §2.3). Resolves false
 * when the read failed (the caller retries); never rejects.
 */
export const refreshOutbox = (): Promise<boolean> => {
    const owner = ownerId;
    const epoch = ownerEpoch;

    if (owner === null || restoreState !== 'ok') {
        return Promise.resolve(true);
    }
    return runOutboxIo(owner, () => readKeys(owner)).then(
        read => {
            if (ownerId === owner && ownerEpoch === epoch) {
                state = read.state;
                notifyOutboxChange();
            }
            return true;
        },
        () => false,
    );
};

// §2.8: pending, failed and unreadable records and, from 03-16b, the conflict drafts.
const countOps = (draft: OutboxState): number =>
    draft.ops.length + draft.failed.size + draft.unreadable.length + draft.conflictDrafts.size;

/** §2.8: the outbox holds `OUTBOX_LIMIT` ops and drafts; no op is appended. */
export const isOutboxFull = (): boolean => countOps(state) >= OUTBOX_LIMIT;

/**
 * The records of `userId`'s outbox in IndexedDB (§1.5 sign-out and account-switch count, 03-16a
 * part C): pending, failed and unreadable records and the conflict drafts (03-16b), read and
 * validated as a restore reads them, without the write lock (a count, not a read-modify-write) and
 * without touching this tab's state, so it works for a user this tab has not restored. Rejects
 * when the keys cannot be read (an IDB error, a key unreadable as a whole).
 */
export const readOutboxRecordCount = (userId: string): Promise<number> =>
    readKeys(userId).then(({ state: read }) => countOps(read));

/**
 * A repeated create of an entry (one client entry id, §2.7) with another draft: the queued create
 * may already be on the server, so it is never replaced (R2-L1).
 */
export class OutboxCreateSentError extends Error {
    override readonly name = 'OutboxCreateSentError';

    constructor() {
        super('The create of this entry is already being sent');
    }
}

// The create of the entry in the queue: pending, sent and waiting for its removal, or failed.
const createIn = (draft: OutboxState, entryId: string): OutboxOpBase | undefined =>
    [...draft.ops, ...[...draft.failed.values()].map(({ op }) => op)].find(
        op => op.entryId === entryId && op.kind === 'createExpense',
    );

// Object keys in a fixed order: equal content has equal text whatever order it was built in.
const sortedKeys = (_key: string, value: unknown): unknown =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value;

// What an op asks the server for, without the fields each append makes anew.
const contentOf = ({ opId: _opId, seq: _seq, createdAt: _createdAt, ...content }: OutboxOpBase) =>
    JSON.stringify(content, sortedKeys);

// §2.7: a repeated create of an entry. The same content is not appended again (true); another
// draft is refused whatever the claim (R2-L1: a create in backoff may already be on the server).
const isRepeatedCreate = (draft: OutboxState, op: OutboxOpBase): boolean => {
    const queued = op.kind === 'createExpense' ? createIn(draft, op.entryId) : undefined;

    if (queued === undefined) {
        return false;
    }
    if (contentOf(queued) !== contentOf(op)) {
        throw new OutboxCreateSentError();
    }
    return true;
};

// An unsent create of the entry (a sent one, still waiting for its removal, has a version).
const hasPendingCreateIn = (draft: OutboxState, entryId: string): boolean =>
    draft.ops.some(
        op =>
            op.entryId === entryId && op.kind === 'createExpense' && !pendingRemovals.has(op.opId),
    );

/** What an append may read of the queue: the draft under the write lock (N3), never memory. */
export interface OutboxAppendView {
    hasPendingCreateOf: (entryId: string) => boolean;
}

/**
 * Appends the op that `build` makes with the next `seq` (C2-16), resolving once the write has
 * landed. A create of an entry that already has the same create in the queue (a repeated submit of
 * the same form, §2.7) is not appended: it resolves with the built op and writes nothing; with
 * another draft it is refused (`OutboxCreateSentError`), nothing is appended. Refused at the
 * limit (`OutboxLimitError`). A rejected write (`OutboxPersistError`): the op does not exist and
 * offline writing is off until restart (§2.8, Sentry `outbox.persist_failed`). A write-lock
 * timeout is a transient `OutboxPersistError` (the `saveRetry` toast): offline writing stays on
 * (Sentry `outbox.write_lock_timeout`).
 */
export const appendOutboxOp = <Op extends OutboxOpBase>(
    build: (seq: number, queue: OutboxAppendView) => Op,
): Promise<Op> =>
    writeOutbox(draft => {
        if (countOps(draft) >= OUTBOX_LIMIT) {
            throw new OutboxLimitError();
        }
        const op = build(draft.nextSeq, {
            hasPendingCreateOf: entryId => hasPendingCreateIn(draft, entryId),
        });

        if (!isRepeatedCreate(draft, op)) {
            draft.nextSeq += 1;
            draft.ops.push(op);
        }
        // §2.6: an edit saved from the form replaces the entry's conflict draft in this same write
        // (any edit of an entry with a draft opens on the draft); a delete makes it moot.
        if (op.kind !== 'createExpense') {
            draft.conflictDrafts.delete(op.entryId);
        }
        return op;
    }).catch((error: unknown) => {
        throw toAppendError(error);
    });

// Why an append was refused, as its caller shows it (§2.8).
const toAppendError = (error: unknown): Error => {
    if (
        error instanceof OutboxLimitError ||
        error instanceof OutboxWriteStoppedError ||
        error instanceof OutboxCreateSentError
    ) {
        return error;
    }
    if (error instanceof OutboxLockTimeoutError) {
        Sentry.captureMessage('outbox.write_lock_timeout', { level: 'warning' });
        return new OutboxPersistError(error);
    }
    persistFailedThisSession = true;
    Sentry.captureMessage('outbox.persist_failed', {
        level: 'warning',
        tags: { 'offline.error': errorName(error) },
    });
    return new OutboxPersistError(error);
};

/**
 * M3: counts an append of the entry from its call (before its write is queued) until it settled.
 * Once none is left and no op of the entry is queued or failed (the append failed), a version kept
 * for it is forgotten.
 */
export const trackOutboxAppend = <T>(entryId: string, append: () => Promise<T>): Promise<T> => {
    appendsInFlight.set(entryId, (appendsInFlight.get(entryId) ?? 0) + 1);
    const settle = (): void => {
        const left = (appendsInFlight.get(entryId) ?? 1) - 1;

        if (left > 0) {
            appendsInFlight.set(entryId, left);
            return;
        }
        appendsInFlight.delete(entryId);
        // A failed op of the entry keeps it too: its Retry is sent with this version (R1 L4).
        if (!entryIdsOf(state).has(entryId)) {
            outboxVersions.delete(entryId);
        }
    };

    return append().finally(settle);
};

/** The pending ops by `seq`. */
export const pendingOutboxOps = (): readonly OutboxOpBase[] => [...state.ops].sort(bySeq);

export const failedOutboxOps = (): readonly FailedOp[] => [...state.failed.values()];

export const isOpFailed = (opId: string): boolean => state.failed.has(opId);

/** The op claimed for sending by any tab (`OutboxState.sending`, §2.3): it cannot be cancelled. */
export const outboxSendingOpId = (): string | null => state.sending?.opId ?? null;

/** Failed records whose op is not readable (§2.5 `unreadable`): kept, counted by the limit. */
export const unreadableOutboxCount = (): number => state.unreadable.length;

/** Discarded in the key (`OutboxState.cancelled`): a restore or an adoption skips it. */
export const isOpCancelledInKey = (opId: string): boolean => state.cancelled.has(opId);

export const cancelledInKey = (): readonly string[] => [...state.cancelled];

/** A failed op whose Retry was requested (by any tab) and not yet settled. */
export const isRetryRequested = (opId: string): boolean =>
    state.failed.has(opId) && state.retryRequested.includes(opId);

/** The failed ops under "Retry", by `seq` (the drain tab adopts them, §2.3). */
export const retryRequestedOps = (): readonly OutboxOpBase[] =>
    state.retryRequested.flatMap(opId => state.failed.get(opId)?.op ?? []).sort(bySeq);

const unreadableEntryIds = (): string[] =>
    state.unreadable.flatMap(({ entryId }) => (entryId === null ? [] : [entryId]));

/** The entries with a failed op (unreadable records with an entry id included). */
export const failedEntryIds = (): ReadonlySet<string> =>
    new Set([...[...state.failed.values()].map(({ op }) => op.entryId), ...unreadableEntryIds()]);

/** The entries with a pending or failed op (§1.4 `outboxState.entryIds`). */
export const outboxEntryIds = (): ReadonlySet<string> =>
    new Set([...entryIdsOf(state), ...unreadableEntryIds()]);

/** Our latest write of the entry, newer than any `baseVersion` (§2.1). */
export const getOutboxVersion = (entryId: string): string | null =>
    outboxVersions.get(entryId) ?? null;

/**
 * After a success: the entry's new version, for its later ops. Whether one is left is decided by
 * the removal write from the draft (N3: another tab may have appended one meanwhile).
 */
export const noteOutboxVersion = (op: OutboxOpBase, version: string | null): void => {
    if (version === null) {
        outboxVersions.delete(op.entryId);
    } else {
        outboxVersions.set(op.entryId, version);
    }
};

/**
 * R2-L2, R3-L1: forgets the version of every entry with no op left in the queue or the failed list
 * (as last read) and none being appended here: a later write of it is based on the cache. After a
 * discard in this tab and after every re-read (another tab's discard).
 */
export const forgetOrphanVersions = (): void => {
    const left = entryIdsOf(state);

    [...outboxVersions.keys()].forEach(entryId => {
        if (!left.has(entryId) && !appendsInFlight.has(entryId)) {
            outboxVersions.delete(entryId);
        }
    });
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

// The claim is this run's: a stale run never clears a newer run's claim (§2.3).
const isClaimOf = (draft: OutboxState, opId: string, fence: OutboxFence): boolean =>
    draft.sending?.opId === opId && draft.sending.session === fence.session;

/**
 * A sent op leaves the queue (and the failed list, after a Retry) and its claim is cleared; the
 * same write keeps the entry's version while another op of it is left in the draft
 * (`OutboxState.versions`), else the version is deleted, here only. Refused once the owner's data
 * changed since the run's fence (not by a stop: a same-owner removal finishes after it).
 */
export const removeOutboxOp = (op: OutboxOpBase, fence: OutboxFence): Promise<void> =>
    writeOutbox(
        draft => {
            draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
            draft.failed.delete(op.opId);
            draft.retryRequested = draft.retryRequested.filter(opId => opId !== op.opId);
            const ownsClaim = isClaimOf(draft, op.opId, fence);

            if (ownsClaim) {
                draft.sending = null;
            }
            // A run of a drain session that is no longer current and no longer holds the claim (a
            // newer holder claimed since) leaves `versions` to that holder: its version may be newer.
            if (!isDrainFence(fence) && !ownsClaim) {
                return { isLeft: true, version: undefined };
            }
            const version = outboxVersions.get(op.entryId);
            // M3: an append of the entry not landed yet counts as a later op of it, and so does a
            // failed op of it (its Retry, R1 L4), as the persisted `versions` count them.
            const isLeft = entryIdsOf(draft).has(op.entryId) || appendsInFlight.has(op.entryId);

            if (version !== undefined && isLeft) {
                draft.versions.set(op.entryId, version);
            } else {
                draft.versions.delete(op.entryId);
            }
            return { isLeft, version };
        },
        { fence },
    ).then(({ isLeft, version }) => {
        pendingRemovals.delete(op.opId);
        if (!isLeft && version !== undefined && outboxVersions.get(op.entryId) === version) {
            outboxVersions.delete(op.entryId);
        }
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

/**
 * A final answer: the op moves from the queue to the failed list (§2.5) and its claim is cleared,
 * in one write of the run's drain session.
 */
export const recordFailedOp = (
    op: OutboxOpBase,
    reason: FailedReason,
    fence: OutboxFence,
): Promise<void> =>
    writeOutbox(
        draft => {
            draft.failed.set(op.opId, { op, reason, failedAt: Date.now() });
            draft.ops = draft.ops.filter(({ opId }) => opId !== op.opId);
            draft.retryRequested = draft.retryRequested.filter(opId => opId !== op.opId);
            if (isClaimOf(draft, op.opId, fence)) {
                draft.sending = null;
            }
        },
        { fence, drain: true },
    );

export const isOpCancelled = (opId: string): boolean => cancelledOpIds.has(opId);

/** The op's run settled: its cancellation is no longer needed (§2.5); per run, not on a stop. */
export const forgetCancelled = (opId: string, fence: OutboxFence): Promise<void> => {
    if (!isOwnerFence(fence)) {
        return Promise.resolve();
    }
    cancelledOpIds.delete(opId);
    return writeOutbox(
        draft => {
            draft.cancelled.delete(opId);
        },
        { fence },
    );
};

export const setOutboxStatus = (opId: string, status: OutboxStatus): void => {
    statusByOpId.set(opId, status);
    statusListeners.forEach(listener => listener(opId, status));
    notifyOutboxChange();
};

/** The drain tab tells the other tabs (`status`, §2.3). */
export const onOutboxStatus = (
    listener: (opId: string, status: OutboxStatus) => void,
): (() => void) => {
    statusListeners.add(listener);
    return () => {
        statusListeners.delete(listener);
    };
};

export const outboxStatus = (opId: string): OutboxStatus | undefined => statusByOpId.get(opId);

/**
 * Why a claim was refused: the drain stopped (or the owner changed), the op left the queue, or the
 * session's token is not the owner's (`auth`).
 */
export type OutboxClaim = 'claimed' | 'stopped' | 'gone' | 'auth';

/**
 * The `sending` claim of §2.3: a compare-and-set under the write lock. With the lock held, the
 * run's drain session is current and the owner unchanged (else `stopped`), the session's token is
 * still the owner's (N4, else `auth`), the op is still pending or failed (a Retry) and neither
 * cancelled nor sent (else `gone`); then `sending = { opId, session }`. A discard whose write lands
 * first makes the claim see the op gone (no request); a claim that lands first makes the discard
 * refuse the op ("already sending"). Rejects only when the write itself failed (transient).
 */
export const claimOutboxOp = (
    op: OutboxOpBase,
    fence: OutboxFence,
    isOwnerSession: () => boolean,
): Promise<OutboxClaim> =>
    writeOutbox(
        (draft): OutboxClaim => {
            // The drain session itself is re-checked by the `drain` guard once the lock is held.
            if (ownerId !== op.owner) {
                return 'stopped';
            }
            if (!isOwnerSession()) {
                return 'auth';
            }
            // A failed op only under "Retry" (§2.3).
            const isQueued =
                draft.ops.some(({ opId }) => opId === op.opId) ||
                (draft.failed.has(op.opId) && draft.retryRequested.includes(op.opId));

            if (
                !isQueued ||
                cancelledOpIds.has(op.opId) ||
                draft.cancelled.has(op.opId) ||
                pendingRemovals.has(op.opId)
            ) {
                return 'gone';
            }
            draft.sending = { opId: op.opId, session: fence.session };
            return 'claimed';
        },
        { fence, drain: true },
    ).catch((error: unknown) => {
        if (error instanceof OutboxWriteStoppedError) {
            return 'stopped';
        }
        throw error;
    });

/**
 * Clears the claim only while it is this run's `{ opId, session }` (compare-and-clear): a stale run
 * never clears a newer run's claim. Before a backoff or a gate wait, so a discard is allowed meanwhile.
 */
export const releaseOutboxClaim = (op: OutboxOpBase, fence: OutboxFence): Promise<void> =>
    writeOutbox(
        draft => {
            if (isClaimOf(draft, op.opId, fence)) {
                draft.sending = null;
            }
        },
        { fence },
    );

// N2: a discard writes the outbox key first (`writeKeys`).
const writeOutboxFirst = <T>(change: (draft: OutboxState) => T): Promise<T> =>
    writeOutbox(change, { outboxFirst: true });

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
interface DraftDiscard {
    discarded: string[];
    refused: string[];
    entries: Set<string>;
    pendingIds: string[];
}

// The claim is read from the draft under the lock: any tab's request in flight is refused.
const isSentIn = (draft: OutboxState, opId: string): boolean =>
    draft.sending?.opId === opId || pendingRemovals.has(opId);

// Removes `opIds` from the draft (those queued or failed and not being sent).
const discardInDraft = (draft: OutboxState, opIds: readonly string[]): DraftDiscard => {
    const refused = opIds.filter(opId => isSentIn(draft, opId));
    const discarded: string[] = [];
    const pendingIds: string[] = [];
    const entries = new Set<string>();

    opIds.forEach(opId => {
        const pending = draft.ops.find(op => op.opId === opId);
        const op = pending ?? draft.failed.get(opId)?.op;

        if (!op || isSentIn(draft, opId)) {
            return;
        }
        discarded.push(opId);
        entries.add(op.entryId);
        draft.failed.delete(opId);
        draft.retryRequested = draft.retryRequested.filter(id => id !== opId);
        // Only a pending op has a run that must resolve `CANCELLED`; it forgets the id.
        if (pending) {
            draft.cancelled.add(opId);
            pendingIds.push(opId);
        }
    });
    draft.ops = draft.ops.filter(({ opId }) => !discarded.includes(opId));
    return { discarded, refused, entries, pendingIds };
};

const afterDiscard = ({ discarded, refused, entries, pendingIds }: DraftDiscard): DiscardResult => {
    pendingIds.forEach(opId => cancelledOpIds.add(opId));
    entries.forEach(entryId => {
        if (hasNoFailureOf(entryId)) {
            outboxGate.unblock(entryId);
        }
    });
    forgetOrphanVersions();
    wake();
    return { discarded, refused };
};

export const discardOps = (opIds: readonly string[]): Promise<DiscardResult> =>
    writeOutboxFirst(draft => discardInDraft(draft, opIds)).then(afterDiscard);

/**
 * Cancels a create with every op of its entry (C2-15), all or nothing (03-16a part B R1 M1/L1): the
 * group is read from the draft under the write lock (an op another tab appended since this tab's
 * last read is in it). When the create is no longer queued or failed (sent, or already
 * discarded), or any op of the group is being sent or waits for its removal, nothing is discarded:
 * the create would reach the server without its later edits, or they would go out for a record
 * that will not exist.
 */
export const discardEntryOps = (createOpId: string): Promise<DiscardResult> =>
    writeOutboxFirst((draft): DraftDiscard => {
        const create =
            draft.ops.find(op => op.opId === createOpId) ?? draft.failed.get(createOpId)?.op;
        const nothing: DraftDiscard = {
            discarded: [],
            refused: [],
            entries: new Set(),
            pendingIds: [],
        };

        if (create?.kind !== 'createExpense') {
            return nothing;
        }
        const group = [...draft.ops, ...[...draft.failed.values()].map(({ op }) => op)]
            .filter(op => op.entryId === create.entryId)
            .map(op => op.opId);
        const refused = group.filter(opId => isSentIn(draft, opId));

        return refused.length > 0 ? { ...nothing, refused } : discardInDraft(draft, group);
    }).then(afterDiscard);

/**
 * "Retry" of failed ops from any tab (§2.3): their ids join `retryRequested` in one write; the drain
 * tab adopts them on the `changed` ping. An op that may not be sent (another owner, `isSendable`
 * false) is not requested. Resolves with the ids that are failed and now requested.
 */
export const requestRetry = (
    opIds: readonly string[],
    isSendable: (op: OutboxOpBase) => boolean,
): Promise<string[]> =>
    writeOutbox(draft => {
        const requested = opIds.filter(opId => {
            const failed = draft.failed.get(opId);

            return failed !== undefined && failed.op.owner === ownerId && isSendable(failed.op);
        });

        draft.retryRequested = [...new Set([...draft.retryRequested, ...requested])];
        return requested;
    });

/** The drain tab learned of another tab's discard: its waiting runs resolve `CANCELLED`. */
export const markOpsCancelled = (opIds: readonly string[]): void => {
    opIds.forEach(opId => cancelledOpIds.add(opId));
    wake();
};

/**
 * The drain tab forgets cancellations that no run will forget (ops discarded before any tab
 * adopted them, §2.3 `cancelled` cleaned for never-adopted ops).
 */
export const forgetCancelledInKey = (
    opIds: readonly string[],
    fence: OutboxFence,
): Promise<void> =>
    opIds.length === 0
        ? Promise.resolve()
        : writeOutbox(
              draft => {
                  opIds.forEach(opId => draft.cancelled.delete(opId));
              },
              { fence, drain: true },
          ).then(() => {
              opIds.forEach(opId => cancelledOpIds.delete(opId));
          });

/** The conflict drafts as last read (§2.6), by `createdAt`. */
export const outboxConflictDrafts = (): readonly ConflictDraft[] =>
    [...state.conflictDrafts.values()].sort((a, b) => a.createdAt - b.createdAt);

export const outboxConflictDraft = (entryId: string): ConflictDraft | null =>
    state.conflictDrafts.get(entryId) ?? null;

const recordField = (value: unknown, field: string): Record<string, unknown> | null => {
    const fieldValue: unknown =
        typeof value === 'object' && value !== null ? Reflect.get(value, field) : null;

    return typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)
        ? Object.fromEntries(Object.entries(fieldValue))
        : null;
};

// §2.6: the fields of the update ops (only the changed ones each) merged in `seq` order onto the
// entry's existing draft (its fields first, its `createdAt` kept).
const mergeIntoDraft = (
    draft: OutboxState,
    entryId: string,
    updates: readonly OutboxOpBase[],
    createdAt: number,
): void => {
    const existing = draft.conflictDrafts.get(entryId);
    const fields = updates.reduce<Record<string, unknown>>(
        (merged, op) => ({ ...merged, ...recordField(op, 'patch') }),
        { ...existing?.fields },
    );
    const last = updates[updates.length - 1];

    draft.conflictDrafts.set(entryId, {
        entryId,
        groupId: stringField(last, 'groupId') ?? existing?.groupId ?? null,
        parentActivityId:
            stringField(last, 'parentActivityId') ?? existing?.parentActivityId ?? null,
        fields,
        createdAt: existing?.createdAt ?? createdAt,
    });
};

/** What `recordConflict` did: a delete conflict keeps no draft. */
export interface OutboxConflict {
    /** The folded run ended with a delete (or was one): dropped, no draft. */
    readonly isDelete: boolean;
}

/**
 * §2.6 (D28): one write of the run's drain session. The conflicting op and every other queued op of
 * its entry leave `ops` (those join `cancelled`: their waiting runs resolve `CANCELLED` without a
 * request), the conflicting op also leaves the failed list and `retryRequested` (a retried failed
 * op), its claim is cleared and the entry's version dropped. Unless the run ends with a delete, the
 * update ops' patches are merged into the entry's conflict draft. Nothing is blocked; the entry is
 * unblocked once no failed op of it is left.
 */
export const recordConflict = (op: OutboxOpBase, fence: OutboxFence): Promise<OutboxConflict> =>
    writeOutbox(
        draft => {
            const folded = draft.ops
                .filter(
                    other =>
                        other.entryId === op.entryId &&
                        other.opId !== op.opId &&
                        !isSentIn(draft, other.opId),
                )
                .sort(bySeq);
            const run = [op, ...folded];
            const foldedIds = folded.map(({ opId }) => opId);
            const isDelete =
                op.kind === 'deleteExpense' || run[run.length - 1]?.kind === 'deleteExpense';

            draft.ops = draft.ops.filter(
                ({ opId }) => opId !== op.opId && !foldedIds.includes(opId),
            );
            foldedIds.forEach(opId => draft.cancelled.add(opId));
            draft.failed.delete(op.opId);
            draft.retryRequested = draft.retryRequested.filter(
                opId => opId !== op.opId && !foldedIds.includes(opId),
            );
            if (isClaimOf(draft, op.opId, fence)) {
                draft.sending = null;
            }
            draft.versions.delete(op.entryId);
            if (!isDelete) {
                mergeIntoDraft(
                    draft,
                    op.entryId,
                    run.filter(({ kind }) => kind === 'updateExpense'),
                    Date.now(),
                );
            }
            return { isDelete, foldedIds };
        },
        { fence, drain: true },
    ).then(({ isDelete, foldedIds }) => {
        foldedIds.forEach(opId => cancelledOpIds.add(opId));
        outboxVersions.delete(op.entryId);
        if (hasNoFailureOf(op.entryId)) {
            outboxGate.unblock(op.entryId);
        }
        wake();
        return { isDelete };
    });

/**
 * 03-16b on the drain-lock restore (in its write): a failed record of the interim reason
 * `conflict` (03-15a…03-16a) becomes the entry's conflict draft (an edit's patch, merged like
 * `recordConflict`), or is dropped (a delete: a delete conflict keeps no draft). Its later ops, no
 * longer blocked, are sent and fold into the draft on their own 409.
 */
export const convertFailedConflicts = (draft: OutboxState): void => {
    [...draft.failed.values()]
        // A create has no version to conflict with: such a record stays failed (Cancel only).
        .filter(({ op, reason }) => reason === 'conflict' && op.kind !== 'createExpense')
        .sort((a, b) => bySeq(a.op, b.op))
        .forEach(({ op, failedAt }) => {
            draft.failed.delete(op.opId);
            draft.retryRequested = draft.retryRequested.filter(opId => opId !== op.opId);
            if (op.kind === 'updateExpense') {
                mergeIntoDraft(draft, op.entryId, [op], failedAt);
            }
        });
};

/**
 * Removes the entry's conflict draft (§2.6: "Discard my changes", the entry deleted remotely), from
 * any tab, under the write lock; idempotent. Resolves whether a draft was removed.
 */
export const dropConflictDraft = (entryId: string): Promise<boolean> =>
    writeOutbox(draft => draft.conflictDrafts.delete(entryId));
