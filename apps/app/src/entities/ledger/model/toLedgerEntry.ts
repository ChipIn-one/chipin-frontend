// The ledger entry (`GET /ledger/entries/{id}`, a write's answer, `settled.entry`) → domain (spec 03
// §1.3, §2.2). The wire is read with zod: the answer of another tab arrives as `unknown` through
// `BroadcastChannel`. Every amount becomes `Money` through `moneyFromWire`.
import { z } from 'zod';

import {
    currencyCode,
    isWireAmount,
    type Money,
    moneyFromWire,
    type WireAmount,
} from 'shared/money';

import type { ExpenseDraft, ExpensePatch } from './types';

/** The fields of an expense that this app reads from the cached entry. */
export interface LedgerEntryExpense {
    readonly description: string | null;
    readonly amount: Money;
    readonly category: string | null;
    /** Unix seconds: the business date. */
    readonly date: number;
    readonly payerId: string;
    readonly participantIds: readonly string[];
}

/** `ledger.entry(id)`: the entry's type and version decide the outbox path and its `If-Match`. */
export interface LedgerEntry {
    readonly id: string;
    readonly type: 'EXPENSE' | 'SETTLEMENT';
    /** Null only for an optimistic create the server has not answered yet. */
    readonly version: string | null;
    readonly groupId: string | null;
    /** Null for a settlement, and when the answer carried no expense. */
    readonly expense: LedgerEntryExpense | null;
}

const ExpenseWireSchema = z.object({
    amount: z.custom<WireAmount>(isWireAmount),
    currency: z.string(),
    description: z.string().nullish(),
    category: z.string().nullish(),
    date: z.number(),
    payer: z.object({ id: z.string() }),
    participants: z.array(z.object({ id: z.string() })),
});

const LedgerEntryWireSchema = z.object({
    id: z.string(),
    type: z.enum(['EXPENSE', 'SETTLEMENT']),
    version: z.string(),
    groupId: z.string().nullish(),
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

/** The entry, or null when it is not readable (the caller reads it again instead). */
export const readLedgerEntry = (wire: unknown): LedgerEntry | null => {
    try {
        return toLedgerEntry(wire);
    } catch {
        return null;
    }
};

/** §2.2: the optimistic entry of a queued create; no version until the server answers. */
export const optimisticCreatedEntry = (entryId: string, draft: ExpenseDraft): LedgerEntry => ({
    id: entryId,
    type: 'EXPENSE',
    version: null,
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
