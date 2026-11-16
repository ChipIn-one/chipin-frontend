// Settle-up amounts (spec 03 §4.5): a remainder smaller than one currency minor unit is
// impossible. `owed` is always the exact `abs(balance.net)` of scale 4 from the backend answer,
// never rebuilt from the field text; the field works in currency minor units.
import type { CurrencyCode, Money } from 'shared/money';
import {
    abs,
    compare,
    divideHalfUp,
    fromUnits,
    isZero,
    ledgerUnitsPerMinor,
    roundToMinor,
    sign,
    sub,
} from 'shared/money';

/** One currency minor unit as an amount: 10^(4 − minorUnits) ledger units (0.01 USD, 1 JPY). */
export const oneMinor = (currency: CurrencyCode): Money =>
    fromUnits(ledgerUnitsPerMinor(currency), currency);

/**
 * The amount a settle-up sends for `input` against the debt `owed`: `null` for an input that is not
 * positive (nothing to pay), exactly `owed` when they differ by less than one minor unit (settled in
 * full), `null` when `input` is above that (not allowed), otherwise `input` (a partial repayment
 * that leaves at least one minor unit).
 */
export const resolveSettleAmount = (input: Money, owed: Money): Money | null => {
    if (sign(input) <= 0) {
        return null;
    }
    if (compare(abs(sub(input, owed)), oneMinor(owed.currency)) < 0) {
        return owed;
    }
    return compare(input, owed) > 0 ? null : input;
};

/**
 * The amount field prefill for `owed`: rounded to minor units, or one minor unit when the debt is
 * below one ("< $0.01"), which `resolveSettleAmount` turns into the exact `owed`.
 */
export const settlePrefill = (owed: Money): Money => {
    const rounded = roundToMinor(owed);

    return isZero(rounded) ? oneMinor(owed.currency) : rounded;
};

/**
 * The "Half" quick pick: half of `owed` (half-up at scale 4) as a prefill in minor units. Half of a
 * debt below two minor units rounds to one minor unit, which settles the debt in full.
 */
export const halfSettlePrefill = (owed: Money): Money =>
    settlePrefill(fromUnits(divideHalfUp(owed.minor, 2n), owed));
