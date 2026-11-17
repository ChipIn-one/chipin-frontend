// User amount input (spec 03 §4.2): replaces `parseAmountInput` of helpers/numbers.ts.
import type { CurrencyCode, Money } from './money';
import { fromUnits, LEDGER_SCALE, minorUnits, unitsToDecimal } from './money';

// Integer digits are bounded like the wire (§4.1, `decimal(19,4)`); `\s` covers NBSP and the
// narrow NBSP that locales use as a group separator.
const MAX_INTEGER_DIGITS = 15;
const SPACES = /\s/g;
const INPUT = /^(\d*)(?:([.,])(\d*))?$/;

/**
 * Parses user input into a non-negative amount, or `null` when it is not a valid amount:
 * spaces are dropped, one `,` or `.` is the decimal separator (none for a currency without
 * fraction digits), at most 15 integer digits and at most `minorUnits(currency)` fraction digits
 * ("1.234" is 1.234 KWD, never one thousand USD).
 * An empty string is `null`, not zero.
 */
export const parseMoneyInput = (raw: string, currency: CurrencyCode): Money | null => {
    const match = INPUT.exec(raw.trim().replace(SPACES, ''));

    if (!match) {
        return null;
    }
    const [, digits = '', separator, fraction = ''] = match;
    // Leading zeros do not count toward the 15-digit limit ("000…001" is 1).
    const integer = digits.replace(/^0+(?=\d)/, '');

    if (
        (integer === '' && fraction === '') ||
        integer.length > MAX_INTEGER_DIGITS ||
        fraction.length > minorUnits(currency) ||
        // A currency without fraction digits takes no separator at all ("12." in JPY, #706).
        (separator !== undefined && minorUnits(currency) === 0)
    ) {
        return null;
    }

    return fromUnits(BigInt(`${integer || '0'}${fraction.padEnd(LEDGER_SCALE, '0')}`), currency);
};

/**
 * An amount as the text of an amount field: a plain decimal with no trailing fraction zeros
 * ("85.5", "100", "0.0034"), so a scale-4 amount loaded for editing keeps every digit it has.
 */
export const moneyInputText = (money: Money): string =>
    unitsToDecimal(money.minor, LEDGER_SCALE).replace(/\.?0+$/, '');

/**
 * An amount with all four ledger digits ("3.3350", "0.0040"): the exact amount a settle-up sends
 * in full (spec 03 §4.5), shown in the caption under the amount field.
 */
export const moneyLedgerText = (money: Money): string => unitsToDecimal(money.minor, LEDGER_SCALE);
