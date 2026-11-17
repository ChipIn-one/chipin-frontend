// The settle-up write mapper (spec 03 §4.5): the domain settlement as the request body of
// `POST /ledger/entries`. The amount goes through `moneyToWire` (a decimal literal of scale 4, no
// double); the currency is the amount's. There is never an `id` (spec 03 §2.7).
import type { components } from 'shared/api/generated/schema';
import type { Money } from 'shared/money';
import { moneyToWire } from 'shared/money';

/**
 * A settlement (settle-up) as the form submits it: `fromUserId` pays `toUserId` the amount, in the
 * amount's currency. A write-only shape, never persisted, so it lives here and not in `types.ts`
 * (whose shape is part of the query cache buster, spec 03 §1.4).
 */
export interface SettlementDraft {
    /** Without it the settlement is between two friends. */
    readonly groupId?: string;
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly amount: Money;
}

export type CreateSettlementWire = components['schemas']['CreateLedgerSettlementRequest'];

/** The body of `POST /ledger/entries` for a settlement. */
export const toSettleUpWire = ({
    groupId,
    fromUserId,
    toUserId,
    amount,
}: SettlementDraft): CreateSettlementWire => ({
    type: 'SETTLEMENT',
    ...(groupId && { groupId }),
    settlement: { fromUserId, toUserId, amount: moneyToWire(amount), currency: amount.currency },
});
