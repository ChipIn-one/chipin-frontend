// LEGACY BRIDGE (spec 03 §4.3, §6 row 6). The expense form still builds its create/update payload
// from JS numbers (`selectExpensePayload`, `buildExpenseUpdateParams`). Until 03-14b builds it
// from `Money`, these adapters carry that payload into the request bodies of `api()`: every number
// becomes the decimal literal `JSON.stringify` wrote for it on the legacy client, so the request
// text is the same. No parsing, rounding or arithmetic happens here.
// TODO(03-14b): replace with `toXWire()` mappers over `Money` (`moneyToWire`) and delete this file.
import type {
    CreateLedgerEntryParams,
    SharingMode,
    UpdateLedgerExpenseParams,
} from 'api/chipin.types';
import type { components } from 'shared/api/generated/schema';
import type { WireAmount, WireDecimal } from 'shared/money';
import { createWireAmount, MoneyWireError } from 'shared/money';

type Schemas = components['schemas'];
export type CreateExpenseBody = Schemas['CreateLedgerExpenseRequest'];
export type UpdateExpenseBody = Schemas['UpdateLedgerExpenseRequest'];

// A plain JSON decimal literal (no exponent): the only form the transport writes.
const PLAIN_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const isWireDecimal = (text: string): text is WireDecimal => PLAIN_DECIMAL.test(text);

// The transport rejects an amount literal that is not plain (`1e-7`, `NaN`): never sent.
const legacyAmount = (value: number): WireAmount => createWireAmount(String(value));

const legacyDecimal = (value: number): WireDecimal => {
    const text = String(value);

    if (!isWireDecimal(text)) {
        throw new MoneyWireError('format');
    }
    return text;
};

const mapShares = <Value>(
    shares: Record<string, number> | undefined,
    toWire: (value: number) => Value,
): Record<string, Value> =>
    Object.fromEntries(
        Object.entries(shares ?? {}).map(([userId, value]) => [userId, toWire(value)]),
    );

const legacySharingMode = (mode: SharingMode): Schemas['SharingMode'] => {
    switch (mode.type) {
        case 'AUTO':
            return { type: 'AUTO' };
        case 'EXACT':
            return { type: 'EXACT', customShares: mapShares(mode.customShares, legacyAmount) };
        case 'PERCENTAGE':
            return {
                type: 'PERCENTAGE',
                percentageShares: mapShares(mode.percentageShares, legacyDecimal),
            };
        case 'SHARES':
            return { type: 'SHARES', shares: mapShares(mode.shares, legacyDecimal) };
    }
};

/** The body of `POST /ledger/entries` for an expense; it never carries an `id` (spec 03 §2.7). */
export const legacyCreateExpenseBody = ({
    groupId,
    description,
    amount,
    date,
    payerId,
    participantIds,
    currency,
    category,
    sharingMode,
}: CreateLedgerEntryParams): CreateExpenseBody => ({
    type: 'EXPENSE',
    ...(groupId && { groupId }),
    expense: {
        description,
        amount: legacyAmount(amount),
        date,
        payerId,
        participantIds,
        currency,
        category: category ?? null,
        sharingMode: legacySharingMode(sharingMode ?? { type: 'AUTO' }),
    },
});

/** The body of `PATCH /ledger/entries/{id}` for an expense: only the fields the patch names. */
export const legacyUpdateExpenseBody = ({
    expense: { amount, sharingMode, ...rest },
}: UpdateLedgerExpenseParams): UpdateExpenseBody => ({
    type: 'EXPENSE',
    expense: {
        ...rest,
        ...(amount !== undefined && { amount: legacyAmount(amount) }),
        ...(sharingMode && { sharingMode: legacySharingMode(sharingMode) }),
    },
});
