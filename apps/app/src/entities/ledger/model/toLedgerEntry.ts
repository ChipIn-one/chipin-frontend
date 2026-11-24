// The ledger entry (`GET /ledger/entries/{id}`, a write's answer, `settled.entry`) → domain (spec 03
// §1.3, §2.2). The wire is read with zod: the answer of another tab arrives as `unknown` through
// `BroadcastChannel`. Every amount becomes `Money` through `moneyFromWire`.
import { z } from 'zod';

import { currencyCode, isWireAmount, moneyFromWire, type WireAmount } from 'shared/money';

import type { ExpenseDraft, ExpensePatch, LedgerEntry } from './types';

const ExpenseWireSchema = z.object({
    amount: z.custom<WireAmount>(isWireAmount),
    currency: z.string(),
    description: z.string().nullish(),
    category: z.string().nullish(),
    date: z.number(),
    payer: z.object({ id: z.string() }),
    participants: z.array(z.object({ id: z.string() })),
});

// What decides the outbox path and its `If-Match`: read on its own, so an expense this app cannot
// read still leaves the answered version (R1 L2).
const LedgerEntryHeadSchema = z.object({
    id: z.string(),
    type: z.enum(['EXPENSE', 'SETTLEMENT']),
    version: z.string(),
    groupId: z.string().nullish(),
    updatedAt: z.number().nullish(),
});

const LedgerEntryWireSchema = LedgerEntryHeadSchema.extend({
    expense: ExpenseWireSchema.nullish(),
});

/** Throws when the entry is not readable (a zod error, an unknown currency, `MoneyWireError`). */
export const toLedgerEntry = (wire: unknown): LedgerEntry => {
    const entry = LedgerEntryWireSchema.parse(wire);
    const expense = entry.type === 'EXPENSE' ? entry.expense : null;

    return {
        id: entry.id,
        type: entry.type,
        version: entry.version,
        updatedAt: entry.updatedAt ?? null,
        groupId: entry.groupId ?? null,
        expense: expense
            ? {
                  description: expense.description ?? null,
                  amount: moneyFromWire(expense.amount, currencyCode(expense.currency)),
                  category: expense.category ?? null,
                  date: expense.date,
                  payerId: expense.payer.id,
                  participantIds: expense.participants.map(({ id }) => id),
              }
            : null,
    };
};

/**
 * The entry; without its expense when only that is not readable; null when not even its type and
 * version are (the caller drops the cached entry and reads it again).
 */
export const readLedgerEntry = (wire: unknown): LedgerEntry | null => {
    try {
        return toLedgerEntry(wire);
    } catch {
        const head = LedgerEntryHeadSchema.safeParse(wire);

        return head.success
            ? {
                  id: head.data.id,
                  type: head.data.type,
                  version: head.data.version,
                  updatedAt: head.data.updatedAt ?? null,
                  groupId: head.data.groupId ?? null,
                  expense: null,
              }
            : null;
    }
};

/** §2.2: the optimistic entry of a queued create; no version until the server answers. */
export const optimisticCreatedEntry = (entryId: string, draft: ExpenseDraft): LedgerEntry => ({
    id: entryId,
    type: 'EXPENSE',
    version: null,
    updatedAt: null,
    groupId: draft.groupId ?? null,
    expense: {
        description: draft.description,
        amount: draft.amount,
        category: draft.category,
        date: draft.date,
        payerId: draft.payerId,
        participantIds: draft.participantIds,
    },
});

/** §2.2: the cached entry with a queued edit applied; its version stays the base version. */
export const optimisticUpdatedEntry = (entry: LedgerEntry, patch: ExpensePatch): LedgerEntry =>
    !entry.expense
        ? entry
        : {
              ...entry,
              expense: {
                  ...entry.expense,
                  ...(patch.description !== undefined && { description: patch.description }),
                  ...(patch.category !== undefined && { category: patch.category }),
                  ...(patch.payerId !== undefined && { payerId: patch.payerId }),
                  ...(patch.amount !== undefined && { amount: patch.amount }),
                  ...(patch.participantIds !== undefined && {
                      participantIds: patch.participantIds,
                  }),
              },
          };

/**
 * §2.6 stale guard: `next` (a conflict's `current`) is older than the cached entry by the server's
 * `updatedAt`, so it must not overwrite it. Unknown on either side (an optimistic entry, a cache
 * written before the field): not older.
 */
export const isOlderLedgerEntry = (next: LedgerEntry, cached: LedgerEntry | undefined): boolean => {
    const cachedAt: unknown = cached?.updatedAt;

    return typeof cachedAt === 'number' && next.updatedAt !== null && next.updatedAt < cachedAt;
};
