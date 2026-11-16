import type { Money } from 'shared/money';

/**
 * How an expense is split, as it is written: `EXACT` amounts are `Money` in the expense currency,
 * `PERCENTAGE` percents and `SHARES` weights are plain decimal text (not money, spec 03 §4.3).
 */
export type ExpenseDraftSharingMode =
    | { readonly type: 'AUTO' }
    | { readonly type: 'EXACT'; readonly customShares: Readonly<Record<string, Money>> }
    | { readonly type: 'PERCENTAGE'; readonly percentageShares: Readonly<Record<string, string>> }
    | { readonly type: 'SHARES'; readonly shares: Readonly<Record<string, string>> };

/** A new expense as the form submits it; the currency is the amount's. */
export interface ExpenseDraft {
    /** Without it the expense is between two friends. */
    readonly groupId?: string;
    readonly description: string | null;
    readonly amount: Money;
    /** Unix seconds: the business date of the expense. */
    readonly date: number;
    readonly payerId: string;
    /** The split order: `split` and the backend distribute the remainder by it. */
    readonly participantIds: readonly string[];
    readonly category: string | null;
    readonly sharingMode: ExpenseDraftSharingMode;
}

/**
 * The changed fields of an expense. The split block (`amount`, `participantIds`, `sharingMode`)
 * is sent whole or not at all. There is no `date`: the form cannot change the date of an expense.
 */
export interface ExpensePatch {
    readonly description?: string | null;
    readonly currency?: string;
    readonly payerId?: string;
    readonly category?: string | null;
    readonly amount?: Money;
    readonly participantIds?: readonly string[];
    readonly sharingMode?: ExpenseDraftSharingMode;
}
