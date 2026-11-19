// The expense write mappers (spec 03 §2.1, §4.3): the domain draft and patch as the request bodies
// of `POST /ledger/entries` and `PATCH /ledger/entries/{id}`. Amounts go through `moneyToWire` (a
// decimal literal of scale 4, no double); percents and weights are `WireDecimal` text. The online
// mutations use them today; the outbox ops (`ExpenseDraftWire`/`ExpensePatchWire`, 03-15a) reuse
// them unchanged.
import { z } from 'zod';

import type { components } from 'shared/api/generated/schema';
import type { Money, WireAmount, WireDecimal } from 'shared/money';
import {
    currencyCode,
    isWireAmount,
    moneyFromWire,
    moneyToWire,
    MoneyWireError,
} from 'shared/money';

import type { ExpenseDraft, ExpenseDraftSharingMode, ExpensePatch } from './types';

type Schemas = components['schemas'];
export type ExpenseSharingModeWire = Schemas['SharingMode'];
/** The `expense` of a create body (an outbox `createExpense` op keeps it with its `groupId`). */
export type ExpenseDraftWire = Schemas['CreateLedgerExpensePayload'];
export type CreateLedgerExpenseWire = Schemas['CreateLedgerExpenseRequest'];
/** The `expense` of a patch body: only the fields the patch names, never `date`. */
export type ExpensePatchWire = Pick<
    Partial<ExpenseDraftWire>,
    'description' | 'currency' | 'payerId' | 'category' | 'amount' | 'participantIds'
> & { sharingMode?: ExpenseSharingModeWire };

const PLAIN_DECIMAL = /^(\d+)(?:\.(\d*))?$/;

/**
 * A non-negative plain decimal in its shortest form ("050.50" → "50.5", "2.0" → "2", "0.000" →
 * "0"), so equal values have equal text; null when the text is not one.
 */
export const canonicalDecimal = (text: string): string | null => {
    const match = PLAIN_DECIMAL.exec(text);

    if (!match) {
        return null;
    }
    const [, digits = '', rawFraction = ''] = match;
    const integer = digits.replace(/^0+(?=\d)/, '');
    const fraction = rawFraction.replace(/0+$/, '');

    return fraction ? `${integer}.${fraction}` : integer;
};

const isWireDecimal = (text: string): text is WireDecimal => canonicalDecimal(text) === text;

// A percent or weight that is not a plain decimal is never sent (the transport rejects it too).
const toWireDecimal = (text: string): WireDecimal => {
    const canonical = canonicalDecimal(text) ?? '';

    if (!isWireDecimal(canonical)) {
        throw new MoneyWireError('format');
    }
    return canonical;
};

const mapValues = <V, X>(
    values: Readonly<Record<string, V>>,
    toX: (value: V) => X,
): Record<string, X> =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, toX(value)]));

const toSharingModeWire = (mode: ExpenseDraftSharingMode): ExpenseSharingModeWire => {
    switch (mode.type) {
        case 'AUTO':
            return { type: 'AUTO' };
        case 'EXACT':
            return { type: 'EXACT', customShares: mapValues(mode.customShares, moneyToWire) };
        case 'PERCENTAGE':
            return {
                type: 'PERCENTAGE',
                percentageShares: mapValues(mode.percentageShares, toWireDecimal),
            };
        case 'SHARES':
            return { type: 'SHARES', shares: mapValues(mode.shares, toWireDecimal) };
    }
};

export interface CreateLedgerEntryWireOptions {
    /**
     * The client entry id (spec 03 §2.7): sent only when the backend has `ledger.clientEntryId`.
     * The online create never sends one.
     */
    readonly clientEntryId?: string;
}

/** The body of `POST /ledger/entries` for an expense; the currency is the amount's. */
export const toCreateLedgerEntryWire = (
    draft: ExpenseDraft,
    { clientEntryId }: CreateLedgerEntryWireOptions = {},
): CreateLedgerExpenseWire => ({
    type: 'EXPENSE',
    ...(clientEntryId && { id: clientEntryId }),
    ...(draft.groupId && { groupId: draft.groupId }),
    expense: {
        description: draft.description,
        amount: moneyToWire(draft.amount),
        date: draft.date,
        payerId: draft.payerId,
        participantIds: [...draft.participantIds],
        currency: draft.amount.currency,
        category: draft.category,
        sharingMode: toSharingModeWire(draft.sharingMode),
    },
});

/** The `expense` of `PATCH /ledger/entries/{id}`: the named fields, the split block last. */
export const toExpensePatchWire = ({
    description,
    currency,
    payerId,
    category,
    amount,
    participantIds,
    sharingMode,
}: ExpensePatch): ExpensePatchWire => ({
    ...(description !== undefined && { description }),
    ...(currency !== undefined && { currency }),
    ...(payerId !== undefined && { payerId }),
    ...(category !== undefined && { category }),
    ...(amount !== undefined && { amount: moneyToWire(amount) }),
    ...(participantIds !== undefined && { participantIds: [...participantIds] }),
    ...(sharingMode !== undefined && { sharingMode: toSharingModeWire(sharingMode) }),
});

const WireAmountSchema = z.custom<WireAmount>(isWireAmount);

// A conflict draft's fields as stored (§2.6): read with zod, they come from IndexedDB.
const ExpensePatchWireSchema = z.object({
    description: z.string().nullish(),
    currency: z.string().optional(),
    payerId: z.string().optional(),
    category: z.string().nullish(),
    amount: WireAmountSchema.optional(),
    participantIds: z.array(z.string()).optional(),
    sharingMode: z
        .discriminatedUnion('type', [
            z.object({ type: z.literal('AUTO') }),
            z.object({
                type: z.literal('EXACT'),
                customShares: z.record(z.string(), WireAmountSchema),
            }),
            z.object({
                type: z.literal('PERCENTAGE'),
                percentageShares: z.record(z.string(), z.string()),
            }),
            z.object({ type: z.literal('SHARES'), shares: z.record(z.string(), z.string()) }),
        ])
        .optional(),
});

const fromSharingModeWire = (
    mode: NonNullable<z.infer<typeof ExpensePatchWireSchema>['sharingMode']>,
    toMoney: (amount: WireAmount) => Money,
): ExpenseDraftSharingMode => {
    switch (mode.type) {
        case 'AUTO':
            return { type: 'AUTO' };
        case 'EXACT':
            return { type: 'EXACT', customShares: mapValues(mode.customShares, toMoney) };
        case 'PERCENTAGE':
            return { type: 'PERCENTAGE', percentageShares: mode.percentageShares };
        case 'SHARES':
            return { type: 'SHARES', shares: mode.shares };
    }
};

/**
 * The domain patch of a stored wire patch (a conflict draft's fields, §2.6): amounts through
 * `moneyFromWire` in the patch's currency, else `fallbackCurrency` (the edited expense's). Null when
 * the fields are not a readable patch.
 */
export const fromExpensePatchWire = (
    fields: unknown,
    fallbackCurrency: string,
): ExpensePatch | null => {
    const parsed = ExpensePatchWireSchema.safeParse(fields);

    if (!parsed.success) {
        return null;
    }
    const { description, currency, payerId, category, amount, participantIds, sharingMode } =
        parsed.data;

    try {
        const code = currencyCode(currency ?? fallbackCurrency);
        const toMoney = (value: WireAmount): Money => moneyFromWire(value, code);

        return {
            ...(description !== undefined && { description }),
            ...(currency !== undefined && { currency: code }),
            ...(payerId !== undefined && { payerId }),
            ...(category !== undefined && { category }),
            ...(amount !== undefined && { amount: toMoney(amount) }),
            ...(participantIds !== undefined && { participantIds }),
            ...(sharingMode !== undefined && {
                sharingMode: fromSharingModeWire(sharingMode, toMoney),
            }),
        };
    } catch {
        return null;
    }
};
