// Decimal strings of the wire and of weights/rates, read the way Java `BigDecimal(String)` reads them.

/** A decimal as Java `BigDecimal` sees it: `unscaled × 10^-scale` (scale may be negative). */
export interface Decimal {
    readonly unscaled: bigint;
    readonly scale: number;
}

// The `BigDecimal(String)` grammar: an optional sign, digits, an optional fraction, an optional
// exponent ("1.5", "100", "1E+2", ".5"). Scales beyond ±1000 are rejected so a hostile weight
// cannot make 10^scale explode.
const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d{1,4}))?$/;
const MAX_SCALE = 1000;

export const parseDecimal = (text: string): Decimal => {
    const match = DECIMAL.exec(text);
    const [, signText = '', integer = '', fraction = '', exponent = '0'] = match ?? [];
    const scale = fraction.length - Number.parseInt(exponent, 10);

    if (!match || integer + fraction === '' || Math.abs(scale) > MAX_SCALE) {
        throw new RangeError(`Invalid decimal: "${text}"`);
    }
    const magnitude = BigInt(integer + fraction);

    return { unscaled: signText === '-' ? -magnitude : magnitude, scale };
};
