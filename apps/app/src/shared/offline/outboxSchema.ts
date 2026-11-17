// The persisted outbox (spec 03 §2.3, §2.5, §5.7): the zod schemas of `chipin:outbox:<userId>`
// (`OutboxState`) and `chipin:outbox-failed:<userId>` (a list of `FailedOp` records). An op is read
// by `OutboxOpBaseSchema` (the fields every kind carries; the kinds' payloads are checked by
// `entities/ledger` on adoption); an op that does not pass moves to failed `unreadable`.
import { z } from 'zod';

export const OUTBOX_KINDS = ['createExpense', 'updateExpense', 'deleteExpense'] as const;

/**
 * `conflict` is the interim reason of 03-15a (a 409 `LEDGER.VERSION_CONFLICT`): it stays readable,
 * 03-16b turns such records into conflict drafts.
 */
export const FAILED_REASONS = [
    'validation',
    'forbidden',
    'deletedRemotely',
    'idConflict',
    'conflict',
    'rejected',
    'unreadable',
    'stale',
] as const;

export const OutboxOpBaseSchema = z.looseObject({
    opId: z.string().min(1),
    seq: z.number().int().positive(),
    owner: z.string().min(1),
    entryKind: z.literal('expense'),
    createdAt: z.number(),
    schema: z.literal(1),
    kind: z.enum(OUTBOX_KINDS),
    entryId: z.string().min(1),
});

/**
 * One key per user. `nextSeq`, `ops` and `cancelled` are strict (a key without them is unreadable as
 * a whole); `ops` are read one by one (an invalid op does not make the key unreadable). The other
 * fields are checked per value on read, so one bad value never locks the queue: an invalid version
 * is dropped (the op then asks the server for it, §2.1), an invalid `sending` claim or
 * `retryRequested` list is reset, `conflictDrafts` (03-16b) is kept as read. Unknown keys of a
 * newer build are kept and written back. `retryRequested` and `sending` are the multi-tab fields of
 * 03-15c, `conflictDrafts` of 03-16b.
 */
export const OutboxStateSchema = z.looseObject({
    nextSeq: z.number().int().positive(),
    ops: z.array(z.unknown()),
    versions: z.unknown(),
    cancelled: z.array(z.string()),
    retryRequested: z.unknown(),
    sending: z.unknown(),
    conflictDrafts: z.unknown(),
});

export const SendingSchema = z.object({ opId: z.string(), session: z.string() }).nullable();

export const RetryRequestedSchema = z.array(z.string());

export const VersionsSchema = z.record(z.string(), z.unknown());

/** What 03-15b writes; unknown keys read from the key are added back. */
export interface PersistedOutboxState {
    nextSeq: number;
    ops: unknown[];
    versions: Record<string, string>;
    cancelled: string[];
    retryRequested: string[];
    sending: z.infer<typeof SendingSchema>;
    conflictDrafts: unknown;
}

/** A failed record; `op` is checked separately (an `unreadable` op is kept as it was read). */
export const FailedOpSchema = z.object({
    op: z.unknown(),
    reason: z.enum(FAILED_REASONS),
    failedAt: z.number(),
});

export const FailedKeySchema = z.array(z.unknown());
