// The single entry into the outbox and its "expenses only" guard (spec 03 §2.1, C2-02): a
// settlement or payment never gets into the queue. An edit or a delete needs the cached entry,
// typed `EXPENSE`; its version is the op's `baseVersion` (null while a create of the entry is
// still queued: it has no version yet).
import type { QueryClient } from '@tanstack/react-query';

import {
    appendOutboxOp,
    hasPendingCreateOf,
    type OutboxKind,
    type OutboxOpBase,
} from './outboxStore';

export const OUTBOX_OPS: Record<OutboxKind, { entryKind: 'expense'; needsCachedEntry: boolean }> = {
    createExpense: { entryKind: 'expense', needsCachedEntry: false },
    updateExpense: { entryKind: 'expense', needsCachedEntry: true },
    deleteExpense: { entryKind: 'expense', needsCachedEntry: true },
};

/** The write cannot go through the outbox: it is sent online or not at all ("Connection required"). */
export class OnlineOnlyError extends Error {
    override readonly name = 'OnlineOnlyError';

    constructor() {
        super('This write is online only');
    }
}

/** The key of the cached ledger entry (`ledger.entry(id)`). */
export const ledgerEntryKey = (entryId: string) => ['ledger', 'entry', entryId] as const;

interface CachedEntry {
    type: unknown;
    version: string | null;
}

const readCachedEntry = (client: QueryClient, entryId: string): CachedEntry | null => {
    const data: unknown = client.getQueryData(ledgerEntryKey(entryId));

    if (typeof data !== 'object' || data === null || !('type' in data)) {
        return null;
    }
    const version: unknown = 'version' in data ? data.version : null;

    return { type: data.type, version: typeof version === 'string' ? version : null };
};

/** The cached entry's type, or null when it is not cached. */
export const cachedEntryType = (client: QueryClient, entryId: string): unknown =>
    readCachedEntry(client, entryId)?.type ?? null;

export interface OutboxOpRequest {
    kind: OutboxKind;
    entryId: string;
    owner: string;
}

/** The base fields the registry assigns and the version an edit or a delete is based on. */
export interface OutboxOpSeed {
    base: OutboxOpBase;
    baseVersion: string | null;
}

/**
 * Appends one op: `build` adds the payload of its kind to the seed. Rejects with
 * `OnlineOnlyError` (nothing appended) for an edit or a delete of an entry that is not a cached
 * expense.
 */
export const enqueueOutboxOp = <Op extends OutboxOpBase>(
    client: QueryClient,
    { kind, entryId, owner }: OutboxOpRequest,
    build: (seed: OutboxOpSeed) => Op,
): Promise<Op> => {
    const { entryKind, needsCachedEntry } = OUTBOX_OPS[kind];
    const cached = readCachedEntry(client, entryId);

    if (needsCachedEntry && cached?.type !== 'EXPENSE') {
        return Promise.reject(new OnlineOnlyError());
    }
    const opId = crypto.randomUUID();
    const createdAt = Date.now();

    return appendOutboxOp(seq =>
        build({
            base: { opId, seq, owner, entryKind, createdAt, schema: 1, kind, entryId },
            baseVersion: hasPendingCreateOf(entryId) ? null : (cached?.version ?? null),
        }),
    );
};
