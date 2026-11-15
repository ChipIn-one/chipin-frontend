// LEGACY BRIDGE (spec 03 §4.3, §6 row 6). The settle-up form still builds its settlement from a JS
// number. Until 03-21 builds it from `Money`, this adapter carries that number into the request
// body of `api()`: it becomes the decimal literal `JSON.stringify` wrote for it on the legacy
// client, so the request text is the same. No parsing, rounding or arithmetic happens here.
// TODO(03-21): replace with a `toXWire()` mapper over `Money` (`moneyToWire`) and delete this file.
import type { CreateSettlementParams } from 'api/chipin.types';
import type { components } from 'shared/api/generated/schema';
import type { WireAmount } from 'shared/money';
import { createWireAmount } from 'shared/money';

export type CreateSettlementBody = components['schemas']['CreateLedgerSettlementRequest'];

// The transport rejects an amount literal that is not plain (`1e-7`, `NaN`): never sent.
const legacyAmount = (value: number): WireAmount => createWireAmount(String(value));

/** The body of `POST /ledger/entries` for a settlement; never with an `id` (spec 03 §2.7). */
export const legacyCreateSettlementBody = ({
    groupId,
    fromUserId,
    toUserId,
    amount,
    currency,
}: CreateSettlementParams): CreateSettlementBody => ({
    type: 'SETTLEMENT',
    ...(groupId && { groupId }),
    settlement: { fromUserId, toUserId, amount: legacyAmount(amount), currency },
});
