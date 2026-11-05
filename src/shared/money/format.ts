// Money display (spec 03 §4.2): `roundToMinor`, then Intl with the currency minor units. The
// formatter gets a decimal string built from `minor` (ES2023 `format(string)`), never a double.
import type { Money } from './money';
import {
    fromUnits,
    LEDGER_SCALE,
    ledgerUnitsPerMinor,
    minorUnits,
    roundToMinor,
    unitsToDecimal,
} from './money';

export interface FormatMoneyOptions {
    /** BCP 47 locale (the caller passes `i18n.resolvedLanguage`); the engine default otherwise. */
    readonly locale?: string;
    readonly currencyDisplay?: 'symbol' | 'code';
    readonly signDisplay?: 'auto' | 'always' | 'exceptZero';
    /** Compact notation ("$1.2K"): Intl's compact rounding instead of the minor units. */
    readonly compact?: boolean;
}

/** Prefix of an amount that is not zero but rounds to zero minor units ("< $0.01"). */
export const BELOW_MINOR_PREFIX = '< ';

const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (money: Money, options: FormatMoneyOptions): Intl.NumberFormat => {
    const { locale, currencyDisplay = 'symbol', signDisplay = 'auto', compact = false } = options;
    const key = [locale ?? '', money.currency, currencyDisplay, signDisplay, compact].join('|');
    const cached = formatters.get(key);

    if (cached) {
        return cached;
    }
    const digits = minorUnits(money.currency);
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: money.currency,
        currencyDisplay,
        signDisplay,
        ...(compact
            ? { notation: 'compact', compactDisplay: 'short' }
            : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    });

    formatters.set(key, formatter);
    return formatter;
};

const isNumericLiteral = (text: string): text is `${number}` => /^-?\d+(?:\.\d+)?$/.test(text);

const numericLiteral = (money: Money): `${number}` => {
    const text = unitsToDecimal(money.minor, LEDGER_SCALE);

    if (!isNumericLiteral(text)) {
        throw new RangeError('Unexpected decimal text');
    }
    return text;
};

/**
 * What is displayed and with which options: the amount rounded to minor units, or, when a
 * non-zero amount rounds to zero, the absolute "< one minor unit" ("< $0.01" for ±0.0040 USD).
 * Below one minor unit the sign is carried by the owe/owed text, so `signDisplay` is ignored.
 */
const displayed = (
    money: Money,
    options: FormatMoneyOptions,
): { value: Money; belowMinor: boolean; options: FormatMoneyOptions } => {
    const rounded = roundToMinor(money);

    if (rounded.minor !== 0n || money.minor === 0n) {
        return { value: rounded, belowMinor: false, options };
    }

    return {
        value: fromUnits(ledgerUnitsPerMinor(money.currency), money.currency),
        belowMinor: true,
        options: { ...options, signDisplay: 'auto' },
    };
};

// `format(string)` keeps full precision only in engines with Intl.NumberFormat v3 (Chrome 106,
// Firefox 116, Safari 15.4); older engines convert the string to a double, so amounts above
// ~1e13 may display wrong there. Accepted: display only, the build target is unchanged.

/** Formats an amount for display: "$1,234.50", "¥1,235", "< $0.01" for ±0.0040 USD. */
export const formatMoney = (money: Money, options: FormatMoneyOptions = {}): string => {
    const shown = displayed(money, options);
    const text = formatterFor(shown.value, shown.options).format(numericLiteral(shown.value));

    return shown.belowMinor ? `${BELOW_MINOR_PREFIX}${text}` : text;
};

/** Like `formatMoney`, as Intl parts (for `basics/numbers/amount/Amount.tsx`). */
export const formatMoneyParts = (
    money: Money,
    options: FormatMoneyOptions = {},
): Intl.NumberFormatPart[] => {
    const shown = displayed(money, options);
    const parts = formatterFor(shown.value, shown.options).formatToParts(
        numericLiteral(shown.value),
    );

    return shown.belowMinor ? [{ type: 'literal', value: BELOW_MINOR_PREFIX }, ...parts] : parts;
};
