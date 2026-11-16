// The money model (spec 03 §4.1, §4.2): `Money { minor: bigint }` in ledger units of scale 4,
// the scale of the backend (`MONEY_SCALE` / `AMOUNT_SCALE`). Arithmetic runs on ledger units;
// currency minor units are used only for rounding to display and for input limits.

/** ISO 4217 code, upper case, three letters. */
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };

/** An exact amount: `minor` integer ledger units of 10⁻⁴ (85.5 → 855000n); there is no -0. */
export interface Money {
    readonly minor: bigint;
    readonly currency: CurrencyCode;
}

/** Ledger scale: the only scale constant on the frontend, changed together with the backend. */
export const LEDGER_SCALE = 4;

/** 10^LEDGER_SCALE: ledger units per currency unit. */
export const LEDGER_UNIT = 10n ** BigInt(LEDGER_SCALE);

export type MinorUnits = 0 | 2 | 3;

export type Sign = -1 | 0 | 1;

/** Two amounts of different currencies met in one operation. */
export class CurrencyMismatchError extends Error {
    override readonly name = 'CurrencyMismatchError';

    constructor(left: CurrencyCode, right: CurrencyCode) {
        super(`Currency mismatch: ${left} vs ${right}`);
    }
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
// Checked before upper-casing: 'uß'.toUpperCase() is 'USS'.
const CURRENCY_INPUT = /^[A-Za-z]{3}$/;

const isCurrencyCode = (value: string): value is CurrencyCode => CURRENCY_PATTERN.test(value);

/** Upper-cases and validates a currency code; throws on anything but three ASCII letters. */
export const currencyCode = (value: string): CurrencyCode => {
    const code = value.toUpperCase();

    if (!CURRENCY_INPUT.test(value) || !isCurrencyCode(code)) {
        throw new RangeError(`Invalid currency code: "${value}"`);
    }
    return code;
};

// ISO 4217 minor units. A table, not Intl: engines disagree on some currencies.
const ZERO_MINOR_UNITS = new Set([
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'ISK',
    'JPY',
    'KMF',
    'KRW',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
]);
const THREE_MINOR_UNITS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Currency minor units (ISO 4217): 0, 3 or, for every other currency, 2. */
export const minorUnits = (currency: CurrencyCode): MinorUnits => {
    if (ZERO_MINOR_UNITS.has(currency)) {
        return 0;
    }
    return THREE_MINOR_UNITS.has(currency) ? 3 : 2;
};

/** Ledger units in one currency minor unit: 10^(4 − minorUnits). */
export const ledgerUnitsPerMinor = (currency: CurrencyCode): bigint =>
    10n ** BigInt(LEDGER_SCALE - minorUnits(currency));

/**
 * A converted, approximate amount (`convert`): still a `Money` for arithmetic and display, but
 * `moneyToWire` does not accept it, and arithmetic keeps it approximate (`add(approx, exact)` is
 * an `ApproxMoney`), so a converted figure never becomes a request amount.
 */
export type ApproxMoney = Money & { readonly approx: true };

export const isApprox = (money: Money): money is ApproxMoney =>
    'approx' in money && money.approx === true;

/**
 * `units` ledger units in `currency`, or in the currency of `like`, keeping its `ApproxMoney` mark:
 * `fromUnits(toUnits(approx), approx)` is still approximate.
 */
export function fromUnits(units: bigint, like: ApproxMoney): ApproxMoney;
export function fromUnits(units: bigint, currencyOrLike: CurrencyCode | Money): Money;
export function fromUnits(units: bigint, currencyOrLike: CurrencyCode | Money): Money {
    if (typeof currencyOrLike === 'string') {
        return { minor: units, currency: currencyOrLike };
    }
    const exact: Money = { minor: units, currency: currencyOrLike.currency };
    const approximate: ApproxMoney = { ...exact, approx: true };

    return isApprox(currencyOrLike) ? approximate : exact;
}

export const toUnits = (money: Money): bigint => money.minor;

/** An amount with the exactness of its inputs: approximate if any input is. */
const derived = (minor: bigint, currency: CurrencyCode, approx: boolean): Money => {
    const exact = fromUnits(minor, currency);
    const approximate: ApproxMoney = { ...exact, approx: true };

    return approx ? approximate : exact;
};

const assertSameCurrency = (left: Money, right: Money): void => {
    if (left.currency !== right.currency) {
        throw new CurrencyMismatchError(left.currency, right.currency);
    }
};

// Overloads carry ApproxMoney through arithmetic at the type level; `derived` does it at runtime.
export function add(left: ApproxMoney, right: Money): ApproxMoney;
export function add(left: Money, right: ApproxMoney): ApproxMoney;
export function add(left: Money, right: Money): Money;
export function add(left: Money, right: Money): Money {
    assertSameCurrency(left, right);
    return derived(left.minor + right.minor, left.currency, isApprox(left) || isApprox(right));
}

export function sub(left: ApproxMoney, right: Money): ApproxMoney;
export function sub(left: Money, right: ApproxMoney): ApproxMoney;
export function sub(left: Money, right: Money): Money;
export function sub(left: Money, right: Money): Money {
    assertSameCurrency(left, right);
    return derived(left.minor - right.minor, left.currency, isApprox(left) || isApprox(right));
}

export function negate(money: ApproxMoney): ApproxMoney;
export function negate(money: Money): Money;
export function negate(money: Money): Money {
    return derived(-money.minor, money.currency, isApprox(money));
}

export function abs(money: ApproxMoney): ApproxMoney;
export function abs(money: Money): Money;
export function abs(money: Money): Money {
    return derived(money.minor < 0n ? -money.minor : money.minor, money.currency, isApprox(money));
}

/** The sum of amounts in `currency`; an empty list is zero; another currency throws. */
export function sum(list: readonly ApproxMoney[], currency: CurrencyCode): ApproxMoney;
export function sum(list: readonly Money[], currency: CurrencyCode): Money;
export function sum(list: readonly Money[], currency: CurrencyCode): Money {
    return list.reduce<Money>((total, money) => add(total, money), fromUnits(0n, currency));
}

const signOf = (value: bigint): Sign => {
    if (value === 0n) {
        return 0;
    }
    return value < 0n ? -1 : 1;
};

export const compare = (left: Money, right: Money): Sign => {
    assertSameCurrency(left, right);
    return signOf(left.minor - right.minor);
};

export const isZero = (money: Money): boolean => money.minor === 0n;

export const sign = (money: Money): Sign => signOf(money.minor);

/**
 * The single "owes / is owed / settled" rule: the sign at scale 4. Settled only when
 * `minor === 0n`; 0.0040 USD is a debt (the backend blocks friend deletion on it).
 */
export const displaySign = (money: Money): Sign => sign(money);

/** `value / divisor` rounded half-up away from zero (`RoundingMode.HALF_UP`); divisor > 0. */
export const divideHalfUp = (value: bigint, divisor: bigint): bigint => {
    const magnitude = value < 0n ? -value : value;
    const quotient = magnitude / divisor;
    const rounded = (magnitude % divisor) * 2n >= divisor ? quotient + 1n : quotient;

    return value < 0n ? -rounded : rounded;
};

/** Rounds half-up away from zero to the currency minor units; the result is scale 4 again. */
export function roundToMinor(money: ApproxMoney): ApproxMoney;
export function roundToMinor(money: Money): Money;
export function roundToMinor(money: Money): Money {
    const step = ledgerUnitsPerMinor(money.currency);

    return derived(divideHalfUp(money.minor, step) * step, money.currency, isApprox(money));
}

/** The plain decimal text of `units` at `scale` (no exponent): 855000n, 4 → "85.5000". */
export const unitsToDecimal = (units: bigint, scale: number): string => {
    const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, '0');
    const integer = digits.slice(0, digits.length - scale);
    const fraction = digits.slice(digits.length - scale);

    return `${units < 0n ? '-' : ''}${integer}${scale > 0 ? `.${fraction}` : ''}`;
};
