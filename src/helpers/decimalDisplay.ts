// String-based decimal rounding and percent display formatting.
// Adapted from syllik/Zero-Touch-DCA src/lib/format/round-decimal.ts and display.ts
// (proprietary; owner-authorized cross-project reuse, 2026-11-02).

export interface RoundedDecimal {
    negative: boolean;
    integer: string;
    fraction: string;
}

const PLAIN_DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const PLAIN_DECIMAL_RESULT = /^-?\d+(\.\d+)?$/;
const PERCENT_DISPLAY_PLACES = 2;
const PERCENT_ESCALATED_PLACES = 4;
const BELOW_DISPLAY_STEP = '< 0.01';

/**
 * Rounds a plain decimal string half away from zero to `places` (≥ 0) fractional
 * digits, working on the digit string so no precision is lost and a carry can
 * cross the point (`9.995` at 2 → `10.00`). `fraction` always has exactly
 * `places` digits, `integer` has no leading zeros (except a single `0`), and a
 * result whose digits are all zero is never negative. Returns `null` for
 * anything that is not a plain decimal (exponents, separators, whitespace, bare
 * points, `+`) or when `places` is not a non-negative integer.
 */
export const roundDecimalHalfUp = (raw: string, places: number): RoundedDecimal | null => {
    if (!Number.isInteger(places) || places < 0) {
        return null;
    }

    const match = PLAIN_DECIMAL.exec(raw);

    if (!match) {
        return null;
    }

    const [, sign, integer, fraction = ''] = match;
    const padded = fraction.padEnd(places + 1, '0');
    let digits = integer + padded.slice(0, places);

    if (padded[places] >= '5') {
        digits = incrementDigits(digits);
    }

    const cut = digits.length - places;
    const result: RoundedDecimal = {
        negative: false,
        integer: digits.slice(0, cut).replace(/^0+(?=\d)/, ''),
        fraction: digits.slice(cut),
    };

    result.negative = sign === '-' && !isZero(result);

    return result;
};

/**
 * Converts a finite number to a plain decimal string. Exponent forms (float
 * noise such as `1.4210854715202004e-14` or values ≥ 1e21) are expanded through
 * `toFixed(20)` so the result always matches `-?\d+(\.\d+)?`.
 */
export const toPlainDecimal = (value: number): string | null => {
    if (!Number.isFinite(value)) {
        return null;
    }

    const plain = String(value);

    if (!/[eE]/.test(plain)) {
        return PLAIN_DECIMAL_RESULT.test(plain) ? plain : null;
    }

    const fixed = value.toFixed(20);

    if (!/[eE]/.test(fixed)) {
        return trimFractionZeros(fixed);
    }

    return expandExponent(fixed);
};

/**
 * Percent total for display: 2 decimals with trailing zeros trimmed. When the
 * 2-decimal display would read `100` while the raw value is not exactly 100, the
 * 4-decimal value is shown instead so the text never claims 100% that the
 * strictly validated total does not have.
 */
export const formatPercentTotal = (value: number): string => {
    const plain = toPlainDecimal(value);
    const rounded = plain === null ? null : roundDecimalHalfUp(plain, PERCENT_DISPLAY_PLACES);

    if (plain === null || !rounded) {
        return '0';
    }

    const display = formatRounded(rounded);

    if (display !== '100' || plain === '100') {
        return display;
    }

    const escalated = roundDecimalHalfUp(plain, PERCENT_ESCALATED_PLACES);

    return escalated ? formatRounded(escalated) : display;
};

/**
 * Percent difference for display: 2 decimals with trailing zeros trimmed. A
 * non-zero difference below the smallest display step reads `< 0.01` instead of
 * `0`, so the message never hides a difference the submit gate still sees.
 */
export const formatPercentDifference = (value: number): string => {
    const plain = toPlainDecimal(value);
    const rounded = plain === null ? null : roundDecimalHalfUp(plain, PERCENT_DISPLAY_PLACES);

    if (plain === null || !rounded) {
        return '0';
    }

    const display = formatRounded(rounded);

    return display === '0' && plain !== '0' ? BELOW_DISPLAY_STEP : display;
};

const isZero = (rounded: RoundedDecimal): boolean =>
    /^0+$/.test(rounded.integer + rounded.fraction);

const incrementDigits = (digits: string): string => {
    let index = digits.length - 1;

    while (index >= 0 && digits[index] === '9') {
        index -= 1;
    }

    const incremented =
        index < 0 ? '1' : digits.slice(0, index) + String.fromCharCode(digits.charCodeAt(index) + 1);

    return incremented + '0'.repeat(digits.length - 1 - index);
};

const trimFractionZeros = (fixed: string): string => {
    const [integer = '0', fraction = ''] = fixed.split('.');
    const trimmed = fraction.replace(/0+$/, '');

    if (trimmed) {
        return `${integer}.${trimmed}`;
    }

    return integer === '-0' ? '0' : integer;
};

const expandExponent = (text: string): string | null => {
    const match = /^(-?)(\d+)(?:\.(\d+))?e\+?(\d+)$/.exec(text);

    if (!match) {
        return null;
    }

    const [, sign = '', integer = '', fraction = '', exponent = ''] = match;
    const zeros = Number(exponent) - fraction.length;

    return zeros < 0 ? null : `${sign}${integer}${fraction}${'0'.repeat(zeros)}`;
};

const formatRounded = ({ negative, integer, fraction }: RoundedDecimal): string => {
    const trimmed = fraction.replace(/0+$/, '');
    const unsigned = trimmed ? `${integer}.${trimmed}` : integer;

    return negative ? `-${unsigned}` : unsigned;
};
