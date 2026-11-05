// The multi-currency balance summary (spec 03 §4.4, KB DSH-001): every balance converted into one
// currency. Rates make it approximate, so every total is an `ApproxMoney` (never a request amount).
// The converted products are summed exactly (bigint fractions, no double) and rounded once.
import type { ApproxMoney, CurrencyCode, Money } from 'shared/money';
import { fromUnits, isZero } from 'shared/money';

/**
 * A conversion rate as a ratio of two decimal strings: `amount × to / from`. It is how rates
 * relative to one base come in (`1 base = from units of the source = to units of the target`),
 * so a cross rate stays exact (−9 EUR at 0.9 is exactly −10 USD) instead of a rounded quotient.
 */
export interface Rate {
    readonly from: string;
    readonly to: string;
}

/** The rate from one currency to another, or `null` if unknown. */
export type RateLookup = (from: CurrencyCode, to: CurrencyCode) => Rate | null;

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

/** An exact fraction `n / d` of ledger units, `d > 0`. */
interface Fraction {
    readonly n: bigint;
    readonly d: bigint;
}

const ZERO: Fraction = { n: 0n, d: 1n };
const SAME_CURRENCY: Rate = { from: '1', to: '1' };

const absBig = (value: bigint): bigint => (value < 0n ? -value : value);

const gcd = (left: bigint, right: bigint): bigint => {
    let [a, b] = [absBig(left), absBig(right)];

    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a === 0n ? 1n : a;
};

const reduce = (n: bigint, d: bigint): Fraction => {
    const divisor = gcd(n, d);

    return { n: n / divisor, d: d / divisor };
};

const addFractions = (left: Fraction, right: Fraction): Fraction =>
    reduce(left.n * right.d + right.n * left.d, left.d * right.d);

// A non-negative decimal (wire rate or `Number#toString` text, maybe with an exponent) as a fraction.
const DECIMAL = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d{1,3}))?$/;

const decimalFraction = (text: string): Fraction | null => {
    const match = DECIMAL.exec(text);
    const [, integer = '', fraction = '', exponent = '0'] = match ?? [];

    if (!match || integer + fraction === '') {
        return null;
    }
    const digits = BigInt(integer + fraction);
    const shift = Number.parseInt(exponent, 10) - fraction.length;

    return shift >= 0
        ? { n: digits * 10n ** BigInt(shift), d: 1n }
        : reduce(digits, 10n ** BigInt(-shift));
};

/** `balance × rate.to / rate.from` exactly, or `null` for an unusable (zero, malformed) rate. */
const convertExact = (balance: Money, rate: Rate): Fraction | null => {
    const from = decimalFraction(rate.from);
    const to = decimalFraction(rate.to);

    if (!from || !to || from.n === 0n || to.n === 0n) {
        return null;
    }
    return reduce(balance.minor * to.n * from.d, to.d * from.n);
};

/**
 * Rounds once, half-up away from zero, to ledger units. A non-zero exact value that rounds to
 * zero keeps one ledger unit with its sign (DSH-001: a real tiny amount is never shown as 0).
 */
const toApprox = ({ n, d }: Fraction, currency: CurrencyCode): ApproxMoney => {
    const magnitude = absBig(n);
    const quotient = magnitude / d;
    let units = (magnitude % d) * 2n >= d ? quotient + 1n : quotient;

    if (units === 0n && magnitude !== 0n) {
        units = 1n;
    }
    return { ...fromUnits(n < 0n ? -units : units, currency), approx: true };
};

/**
 * Converts every non-zero balance into `target` and sums it by direction exactly; each total is
 * rounded once. A balance whose rate is unknown is skipped and listed in `unconverted`; a balance
 * already in `target` needs no rate.
 */
export const summarizeBalances = (
    balances: readonly Money[],
    target: CurrencyCode,
    rateOf: RateLookup,
): BalanceSummary => {
    let owed = ZERO;
    let owing = ZERO;
    let converted = false;
    const unconverted: CurrencyCode[] = [];

    for (const balance of balances) {
        if (isZero(balance)) {
            continue;
        }
        const isSame = balance.currency === target;
        const rate = isSame ? SAME_CURRENCY : rateOf(balance.currency, target);
        const amount = rate && convertExact(balance, rate);

        if (!amount) {
            unconverted.push(balance.currency);
            continue;
        }
        converted ||= !isSame;

        if (amount.n > 0n) {
            owed = addFractions(owed, amount);
        } else {
            owing = addFractions(owing, { n: -amount.n, d: amount.d });
        }
    }

    return {
        net: toApprox(addFractions(owed, { n: -owing.n, d: owing.d }), target),
        owed: toApprox(owed, target),
        owing: toApprox(owing, target),
        converted,
        unconverted,
    };
};
