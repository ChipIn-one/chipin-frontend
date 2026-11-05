// User amount input (spec 03 §4.2): replaces `parseAmountInput` of helpers/numbers.ts.
import type { CurrencyCode, Money } from './money';
import { fromUnits, LEDGER_SCALE, minorUnits } from './money';

// Integer digits are bounded like the wire (§4.1, `decimal(19,4)`); `\s` covers NBSP and the
// narrow NBSP that locales use as a group separator.
const MAX_INTEGER_DIGITS = 15;
const SPACES = /\s/g;
const INPUT = /^(\d*)(?:[.,](\d*))?$/;

/**
 * Parses user input into a non-negative amount, or `null` when it is not a valid amount:
 * spaces are dropped, one `,` or `.` is the decimal separator, at most 15 integer digits and at
 * most `minorUnits(currency)` fraction digits ("1.234" is 1.234 KWD, never one thousand USD).
 * An empty string is `null`, not zero.
 */
export const parseMoneyInput = (raw: string, currency: CurrencyCode): Money | null => {
    const match = INPUT.exec(raw.trim().replace(SPACES, ''));

    if (!match) {
        return null;
    }
    const [, digits = '', fraction = ''] = match;
    // Leading zeros do not count toward the 15-digit limit ("000…001" is 1).
    const integer = digits.replace(/^0+(?=\d)/, '');

    if (
        (integer === '' && fraction === '') ||
        integer.length > MAX_INTEGER_DIGITS ||
        fraction.length > minorUnits(currency)
    ) {
        return null;
    }

    return fromUnits(BigInt(`${integer || '0'}${fraction.padEnd(LEDGER_SCALE, '0')}`), currency);
};
