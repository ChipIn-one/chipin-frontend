// The multi-currency balance summary (spec 03 §4.4): every balance converted into one currency.
// Rates make it approximate, so every total is an `ApproxMoney` (never a request amount).
import type { ApproxMoney, CurrencyCode, Money } from 'shared/money';
import { add, convert, fromUnits, isZero, sign, sub } from 'shared/money';

/** The decimal rate from one currency to another (`1 from = rate × to`), or `null` if unknown. */
export type RateLookup = (from: CurrencyCode, to: CurrencyCode) => string | null;

export interface BalanceSummary {
    /** Owed minus owing, in the target currency. */
    readonly net: ApproxMoney;
    /** What you are owed, in the target currency (≥ 0). */
    readonly owed: ApproxMoney;
    /** What you owe, as a magnitude in the target currency (≥ 0). */
    readonly owing: ApproxMoney;
    /** Whether a balance in another currency was converted. */
    readonly converted: boolean;
    /** Currencies of non-zero balances left out for lack of a rate, in input order. */
    readonly unconverted: CurrencyCode[];
}

const approxZero = (currency: CurrencyCode): ApproxMoney => ({
    ...fromUnits(0n, currency),
    approx: true,
});

/**
 * Converts every non-zero balance into `target` (half-up to scale 4, `convert`) and sums it by
 * direction. A balance whose rate is unknown is skipped and listed in `unconverted`.
 */
export const summarizeBalances = (
    balances: readonly Money[],
    target: CurrencyCode,
    rateOf: RateLookup,
): BalanceSummary => {
    let owed = approxZero(target);
    let owing = approxZero(target);
    let converted = false;
    const unconverted: CurrencyCode[] = [];

    for (const balance of balances) {
        if (isZero(balance)) {
            continue;
        }
        const rate = balance.currency === target ? '1' : rateOf(balance.currency, target);

        if (rate === null) {
            unconverted.push(balance.currency);
            continue;
        }
        converted ||= balance.currency !== target;
        const amount = convert(balance, rate, target);

        if (sign(amount) > 0) {
            owed = add(owed, amount);
        } else {
            owing = sub(owing, amount);
        }
    }

    return { net: sub(owed, owing), owed, owing, converted, unconverted };
};
