// WireAmount ↔ Money (spec 03 §4.1, §4.2). Called only in the `entities/*/model` mappers.
// The decimal literal is parsed as text: no Number, no double, at any magnitude.
import * as Sentry from '@sentry/react';

import type { CurrencyCode, Money } from './money';
import { fromUnits, LEDGER_SCALE, unitsToDecimal } from './money';
import type { WireAmount } from './wire';
import { createWireAmount, MoneyWireError, wireAmountText } from './wire';

// The backend column `decimal(19,4)`: |v| ≤ 999 999 999 999 999.9999, written by `toPlainString`
// of scale 4 (no exponent). Anything else is a hard rejection, never a silent value.
const WIRE_DECIMAL = /^(-?)(\d{1,15})(?:\.(\d{1,4}))?$/;

/** |minor| < 10¹⁹: the largest `decimal(19,4)` amount in ledger units. */
const MAX_UNITS = 10n ** 19n;

// Mappers run synchronously inside `mapItems`, which reports once per item id itself; while it
// runs, a rejection is not reported a second time here.
let mappingDepth = 0;

const reportReject = (error: MoneyWireError, extra: Record<string, string> = {}): void => {
    // Only the reason code and ids: the amount itself never reaches Sentry.
    Sentry.captureMessage('money.wire_reject', {
        level: 'error',
        tags: { 'money.reason': error.reason },
        extra,
    });
};

const reject = (reason: MoneyWireError['reason']): never => {
    const error = new MoneyWireError(reason);

    if (mappingDepth === 0) {
        reportReject(error);
    }
    throw error;
};

/** Reads a wire amount: `"85.5"` → 855000n; `-0` → 0n; out of bounds or malformed → MoneyWireError. */
export const moneyFromWire = (value: WireAmount, currency: CurrencyCode): Money => {
    let text: string;

    try {
        text = wireAmountText(value);
    } catch {
        return reject('shape');
    }
    const match = WIRE_DECIMAL.exec(text);

    if (!match) {
        return reject('format');
    }
    const [, negative = '', integer = '', fraction = ''] = match;
    const units = BigInt(`${negative}${integer}${fraction.padEnd(LEDGER_SCALE, '0')}`);

    // BigInt('-0') is 0n: -0 does not exist in the domain.
    return fromUnits(units, currency);
};

/** Writes an amount as a plain decimal literal of scale 4 (`|minor| < 10¹⁹`, else MoneyWireError). */
export const moneyToWire = (money: Money & { readonly approx?: never }): WireAmount => {
    if (money.minor >= MAX_UNITS || money.minor <= -MAX_UNITS) {
        return reject('range');
    }
    return createWireAmount(unitsToDecimal(money.minor, LEDGER_SCALE));
};

/** An item whose amounts could not be read; the UI renders "This entry cannot be shown". */
export interface InvalidItem {
    readonly kind: 'invalid';
    readonly id: string;
}

// Item ids already reported; bounded so a long session does not grow it without limit.
const reportedIds = new Set<string>();
const MAX_REPORTED_IDS = 1000;

const reportItemOnce = (error: MoneyWireError, id: string): void => {
    if (reportedIds.has(id)) {
        return;
    }
    if (reportedIds.size >= MAX_REPORTED_IDS) {
        reportedIds.clear();
    }
    reportedIds.add(id);
    reportReject(error, { itemId: id });
};

/**
 * Maps a list item by item: a `MoneyWireError` in one item's mapper turns only that item into
 * `{ kind: 'invalid', id }` (Sentry once per id); the rest of the list works. Other errors propagate.
 */
export const mapItems = <T, X>(
    list: readonly T[],
    toX: (item: T) => X,
    id: (item: T) => string,
): (X | InvalidItem)[] =>
    list.map(item => {
        mappingDepth += 1;
        try {
            return toX(item);
        } catch (error) {
            if (!(error instanceof MoneyWireError)) {
                throw error;
            }
            const itemId = id(item);

            reportItemOnce(error, itemId);
            return { kind: 'invalid', id: itemId } satisfies InvalidItem;
        } finally {
            mappingDepth -= 1;
        }
    });

/** Test support: forgets which item ids were reported. */
export const resetReportedItems = (): void => {
    reportedIds.clear();
};
