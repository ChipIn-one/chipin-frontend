// The outbox overlay (spec 03 §2.2, §2.5, 03-16a part B): this tab's view of the persisted queue
// for the UI (`OutboxSheet`, the header badge, the balance caption, the expense history). It is
// the last read of the keys (re-read on the `changed` ping), with each pending op's status from
// the drain tab. Its actions are the outbox's own: Retry adds failed ops to `retryRequested`, a
// discard is refused by the store for an op being sent. Flag off: a constant empty view, no
// subscription, nothing read.
import { useSyncExternalStore } from 'react';

import type { Money } from 'shared/money';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { discardOutboxOps, outboxOpStatus, retryOutboxOps } from 'shared/offline/outboxDrain';
import { isStoragePersisted } from 'shared/offline/outboxRegistry';
import {
    failedOutboxOps,
    type FailedReason,
    isPendingRemoval,
    isRetryRequested,
    onOutboxChange,
    outboxChangeRevision,
    type OutboxKind,
    type OutboxOpBase,
    outboxOwner,
    type OutboxRestore,
    outboxRestoreState,
    outboxSendingOpId,
    pendingOutboxOps,
} from 'shared/offline/outboxStore';

import { pendingExpenseAmount, pendingExpenseShare } from '../model/pendingShare';

import { type LedgerOutboxOp, LedgerOutboxOpSchema } from './outbox';

/** A pending op's status: claimed (`sending`), its run's last status, or none yet (`queued`). */
export type OutboxItemStatus =
    | 'queued'
    | 'sending'
    | 'waiting-network'
    | 'server-unavailable'
    | 'sign-in-required'
    | 'update-required'
    | 'failed-unsaved';

interface OutboxItemBase {
    readonly opId: string;
    readonly entryId: string;
    readonly kind: OutboxKind;
    /** The expense's description, when the op carries one. */
    readonly description: string | null;
    /** A create's amount. */
    readonly amount: Money | null;
    /** A create's share of the signed-in user (§3, D20). */
    readonly share: Money | null;
    /**
     * The other ops of the entry, cancelled with a create (C2-15: no PATCH/DELETE goes out for a
     * record that will not exist); empty for an edit or a delete.
     */
    readonly relatedOpIds: readonly string[];
    /** Neither claimed nor sent (§2.5): a discard of it would be refused, so it is not offered. */
    readonly canCancel: boolean;
}

export interface PendingOutboxItem extends OutboxItemBase {
    readonly status: OutboxItemStatus;
}

export interface FailedOutboxItem extends OutboxItemBase {
    readonly reason: FailedReason;
    /** Its Retry was requested (by any tab) and has not settled. */
    readonly isRetrying: boolean;
    /** A readable expense op of this user that a Retry would send again. */
    readonly canRetry: boolean;
}

export interface OutboxOverlay {
    /** This tab's `outboxRestore` (§1.6); `off` with the flag off or no outbox owner. */
    readonly restore: OutboxRestore | 'off';
    /** By `seq`. */
    readonly pending: readonly PendingOutboxItem[];
    readonly failed: readonly FailedOutboxItem[];
    /** Pending and failed ops: the badge and the balance counter. */
    readonly count: number;
    readonly pendingCreates: ReadonlySet<string>;
    readonly pendingUpdatesByEntryId: ReadonlyMap<string, number>;
    /** Entries with a queued delete: their edit and delete are not offered again. */
    readonly pendingDeletes: ReadonlySet<string>;
    readonly statusByOpId: ReadonlyMap<string, OutboxItemStatus>;
    /** §2.8 C3-10: the browser answered that it may evict the device's data. */
    readonly isStorageNotPersisted: boolean;
}

const EMPTY_OVERLAY: OutboxOverlay = {
    restore: 'off',
    pending: [],
    failed: [],
    count: 0,
    pendingCreates: new Set(),
    pendingUpdatesByEntryId: new Map(),
    pendingDeletes: new Set(),
    statusByOpId: new Map(),
    isStorageNotPersisted: false,
};

const asLedgerOp = (op: OutboxOpBase): LedgerOutboxOp | null => {
    const parsed = LedgerOutboxOpSchema.safeParse(op);

    return parsed.success ? parsed.data : null;
};

const createAmount = (op: LedgerOutboxOp | null): Money | null =>
    op?.kind === 'createExpense' ? pendingExpenseAmount(op.draft) : null;

const descriptionOf = (op: LedgerOutboxOp | null): string | null => {
    switch (op?.kind) {
        case 'createExpense':
            return op.draft.description ?? null;
        case 'updateExpense':
            return op.patch.description ?? null;
        default:
            return null;
    }
};

const buildOverlay = (): OutboxOverlay => {
    const owner = outboxOwner();

    if (owner === null) {
        return EMPTY_OVERLAY;
    }
    const pendingOps = pendingOutboxOps();
    const failedOps = failedOutboxOps();
    const sendingOpId = outboxSendingOpId();
    const allOps = [...pendingOps, ...failedOps.map(({ op }) => op)];
    const base = (op: OutboxOpBase): OutboxItemBase => {
        const ledgerOp = asLedgerOp(op);

        return {
            opId: op.opId,
            entryId: op.entryId,
            kind: op.kind,
            description: descriptionOf(ledgerOp),
            amount: createAmount(ledgerOp),
            share:
                ledgerOp?.kind === 'createExpense'
                    ? pendingExpenseShare(ledgerOp.draft, owner)
                    : null,
            relatedOpIds:
                op.kind === 'createExpense'
                    ? allOps
                          .filter(other => other.entryId === op.entryId && other.opId !== op.opId)
                          .map(other => other.opId)
                    : [],
            canCancel: op.opId !== sendingOpId && !isPendingRemoval(op.opId),
        };
    };
    const statusByOpId = new Map<string, OutboxItemStatus>();
    const pending = pendingOps.map((op): PendingOutboxItem => {
        const remote = outboxOpStatus(op.opId);
        const status: OutboxItemStatus = op.opId === sendingOpId ? 'sending' : (remote ?? 'queued');

        statusByOpId.set(op.opId, status);
        return { ...base(op), status };
    });
    const failed = failedOps.map(({ op, reason }): FailedOutboxItem => ({
        ...base(op),
        reason,
        isRetrying: isRetryRequested(op.opId),
        canRetry:
            reason !== 'unreadable' &&
            reason !== 'conflict' &&
            op.owner === owner &&
            asLedgerOp(op) !== null,
    }));
    const pendingUpdatesByEntryId = new Map<string, number>();

    pendingOps
        .filter(op => op.kind === 'updateExpense')
        .forEach(op => {
            pendingUpdatesByEntryId.set(
                op.entryId,
                (pendingUpdatesByEntryId.get(op.entryId) ?? 0) + 1,
            );
        });

    return {
        restore: outboxRestoreState(owner),
        pending,
        failed,
        count: pending.length + failed.length,
        pendingCreates: new Set(
            pendingOps.filter(op => op.kind === 'createExpense').map(op => op.entryId),
        ),
        pendingUpdatesByEntryId,
        pendingDeletes: new Set(
            pendingOps.filter(op => op.kind === 'deleteExpense').map(op => op.entryId),
        ),
        statusByOpId,
        isStorageNotPersisted: isStoragePersisted() === false,
    };
};

// One view per change: `useSyncExternalStore` needs the same object until the outbox changed.
let cached: { revision: number; overlay: OutboxOverlay } | null = null;

const readOverlay = (): OutboxOverlay => {
    const revision = outboxChangeRevision();

    if (cached?.revision !== revision) {
        cached = { revision, overlay: buildOverlay() };
    }
    return cached.overlay;
};

const readEmpty = (): OutboxOverlay => EMPTY_OVERLAY;

const subscribeNothing = (): (() => void) => () => undefined;

/**
 * `useOutboxOverlay()` of §2.2: the queue as this tab last read it, re-rendered on every change.
 * Flag off: the empty view, no subscription.
 */
export const useOutboxOverlay = (): OutboxOverlay => {
    const isOn = isOfflineWritesFlagOn();

    return useSyncExternalStore(
        isOn ? onOutboxChange : subscribeNothing,
        isOn ? readOverlay : readEmpty,
        readEmpty,
    );
};

/**
 * "Cancel operation" (§2.5): the op, and with a create the other ops of its entry, in one discard.
 * Resolves with the ids the store refused because they are being sent (none is cancelled then).
 */
export const discardOutboxItem = (item: OutboxItemBase): Promise<readonly string[]> =>
    discardOutboxOps([item.opId, ...item.relatedOpIds]).then(({ refused }) => refused);

/** "Retry" of a failed op (§2.5): resolves whether it was requested. */
export const retryOutboxItem = (item: FailedOutboxItem): Promise<boolean> =>
    retryOutboxOps([item.opId]).then(requested => requested.includes(item.opId));
