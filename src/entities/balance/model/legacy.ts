// LEGACY BRIDGE (spec 03 §4.1 item 5, §4.4). The legacy `src/api/*` layer still reads money with
// `JSON.parse`, so its DTOs carry amounts as JS numbers (`BalanceEntry.netBalance`, activity
// `amount`/`shareAmount`) and rates as numbers. Until a
// store is migrated to the generated types (`WireAmount` → `moneyFromWire`, 03-4a/03-4b and the
// store PRs of §6), these adapters carry those numbers into `Money` and back for the
// number-based display components.
//
// Restrictions: every export is named `legacy*` and takes or returns a legacy DTO shape only; the
// raw number → Money conversion is not exported. ESLint (`money-legacy-bridge`) forbids importing
// `legacy*` names of this entity in `src/{app,shared,entities}/**` outside it, by alias or relative
// path. Delete each adapter with its last caller.
//
// Bad legacy input (a currency that is not three letters, a non-finite or non-number amount) never
// throws during render: the entry is skipped and `money.legacy_reject` is reported once per reason.
// The strict throw stays in `shared/money` for the new wire path.
import * as Sentry from '@sentry/react';

import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry, CurrenciesRates } from 'api/chipin.raw.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import type { ActivityEvent, ActivityPreview, MoneyReader } from 'entities/activity';
import { toActivityEventWith } from 'entities/activity';
import type { CurrencyCode, Money } from 'shared/money';
import { abs, currencyCode, fromUnits, LEDGER_SCALE, MoneyWireError, sign } from 'shared/money';

import { aggregateByCurrency } from './aggregate';
import type { BalancePartition } from './partition';
import { partitionBalances } from './partition';
import type { RateLookup } from './summary';
import { summarizeBalances } from './summary';
import type { Balance } from './types';

type RejectReason = 'currency' | 'amount';

// Reasons already reported this session: one event per reason, never the amount or currency.
const reportedReasons = new Set<RejectReason>();

const reportReject = (reason: RejectReason): null => {
    if (!reportedReasons.has(reason)) {
        reportedReasons.add(reason);
        Sentry.captureMessage('money.legacy_reject', {
            level: 'error',
            tags: { 'money.reason': reason },
        });
    }
    return null;
};

/** Test support: forgets which reasons were reported. */
export const resetLegacyRejectReports = (): void => {
    reportedReasons.clear();
};

const CURRENCY_INPUT = /^[A-Za-z]{3}$/;

const legacyCurrency = (value: unknown): CurrencyCode | null =>
    typeof value === 'string' && CURRENCY_INPUT.test(value) ? currencyCode(value) : null;

/** A legacy currency (the user's default, a rate target), or `DEFAULT_CURRENCY_CODE` if invalid. */
export const legacyCurrencyOrDefault = (value: unknown): CurrencyCode =>
    legacyCurrency(value) ?? currencyCode(DEFAULT_CURRENCY_CODE);

// The shortest round-trip text of a double (`Number#toString`), optionally with an exponent.
const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;
const SCALE = BigInt(LEDGER_SCALE);

/**
 * A legacy number amount as `Money`: its shortest decimal text rounded half-up (away from zero)
 * to scale 4, the same value `normalizeApiMoneyAmount` gives today; `null` (reported) for an
 * invalid currency or a non-finite / non-number amount.
 *
 * Exactness: a wire literal of scale ≤ 4 with |v| < 1e11 has ≤ 15 significant digits, so
 * `JSON.parse` → `toString` returns that literal and the result equals the wire amount exactly.
 * Above 1e11 the double may already have lost the last digit (spec 03 §4.1 table); the result is
 * then the same as the legacy code shows, no worse.
 */
const moneyFromLegacyNumber = (value: unknown, currency: unknown): Money | null => {
    const code = legacyCurrency(currency);

    if (!code) {
        return reportReject('currency');
    }
    const match = typeof value === 'number' ? NUMBER_TEXT.exec(String(value)) : null;

    if (!match) {
        return reportReject('amount');
    }
    const [, negative = '', integer = '', fraction = '', exponent = '0'] = match;
    // value = digits × 10^shift ledger units.
    const digits = BigInt(integer + fraction);
    const shift = Number.parseInt(exponent, 10) - fraction.length + LEDGER_SCALE;
    let units: bigint;

    if (shift >= 0) {
        units = digits * 10n ** BigInt(shift);
    } else {
        const divisor = 10n ** BigInt(-shift);
        const quotient = digits / divisor;

        units = (digits % divisor) * 2n >= divisor ? quotient + 1n : quotient;
    }
    // BigInt has no -0: a negative value that rounds to zero is 0n.
    return fromUnits(negative ? -units : units, code);
};

/** A legacy amount number for the number-based display components (`Amount`, `DebtAmount`). */
export const legacyAmountFromMoney = (money: Money): number => {
    const magnitude = abs(money).minor;
    const unit = 10n ** SCALE;
    const fraction = (magnitude % unit).toString().padStart(LEDGER_SCALE, '0');

    // Exact for |v| < 1e11 (≤ 15 significant digits); the nearest double above.
    return Number(`${sign(money) < 0 ? '-' : ''}${magnitude / unit}.${fraction}`);
};

/** `null` (reported) when the entry's currency or amount is invalid. */
export const legacyBalanceFromEntry = (entry: BalanceEntry): Balance | null => {
    const net = moneyFromLegacyNumber(entry.netBalance, entry.currency);

    return net && { net };
};

export const legacyEntryFromMoney = (money: Money): BalanceEntry => ({
    currency: money.currency,
    netBalance: legacyAmountFromMoney(money),
});

interface ValidEntry {
    readonly entry: BalanceEntry;
    readonly net: Money;
}

const validEntries = (entries: readonly BalanceEntry[]): ValidEntry[] =>
    entries.flatMap(entry => {
        const balance = legacyBalanceFromEntry(entry);

        return balance ? [{ entry, net: balance.net }] : [];
    });

/** Splits legacy entries by `displaySign` of their exact balance; invalid entries are skipped. */
export const legacyPartitionEntries = (
    entries: readonly BalanceEntry[],
): BalancePartition<BalanceEntry> => {
    const { owed, owe, settled } = partitionBalances(validEntries(entries), item => item.net);
    const toEntries = (items: readonly ValidEntry[]) => items.map(item => item.entry);

    return { owed: toEntries(owed), owe: toEntries(owe), settled: toEntries(settled) };
};

/** Exact per-currency sums of legacy entries (first-appearance order); invalid ones skipped. */
export const legacySumEntriesByCurrency = (entries: readonly BalanceEntry[]): Money[] =>
    aggregateByCurrency(validEntries(entries), item => item.net).map(({ total }) => total);

// A legacy amount that cannot be read makes its event an unknown event (reported once per reason).
const readLegacyAmount: MoneyReader<number> = (amount, currency) => {
    const money = moneyFromLegacyNumber(amount, currency);

    if (!money) {
        throw new MoneyWireError('shape');
    }
    return money;
};

/** A legacy activity event as the domain event (amounts as `Money`) for the shared activity cards. */
export const legacyActivityEvent = (event: AppEvent): ActivityEvent => {
    try {
        return toActivityEventWith(event, readLegacyAmount);
    } catch (error) {
        if (!(error instanceof MoneyWireError)) {
            throw error;
        }
        return toActivityEventWith({ ...event, metadata: null }, readLegacyAmount);
    }
};

/** A legacy preview (`{ parent, lastEvent }`) as the domain preview. */
export const legacyActivityPreview = (item: ActivityFeedItem): ActivityPreview => ({
    parent: legacyActivityEvent(item.parent),
    lastEvent: legacyActivityEvent(item.lastEvent),
});

const legacyRate = (value: unknown): string | null =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(value) : null;

/**
 * Rates of the legacy dashboard (`rates[c]` units of `c` per one `base`) as a `RateLookup`: the
 * pair `rates[from]`, `rates[to]` as decimal text, so the cross rate is computed exactly by
 * `summarizeBalances` (no rounded quotient).
 */
export const legacyRateLookup =
    (rates: CurrenciesRates, baseCurrency: string): RateLookup =>
    (from, to) => {
        const fromRate = from === baseCurrency ? '1' : legacyRate(rates[from]);
        const toRate = to === baseCurrency ? '1' : legacyRate(rates[to]);

        return fromRate && toRate ? { from: fromRate, to: toRate } : null;
    };

/**
 * Rates as decimal text (`entities/currency-rates`) as the legacy number map read by the
 * not-yet-migrated group summaries and sorting; a malformed or non-positive rate is left out
 * (a missing rate means "cannot convert" there).
 */
export const legacyRatesFromDecimals = (rates: Readonly<Record<string, string>>): CurrenciesRates =>
    Object.fromEntries(
        Object.entries(rates).flatMap(([currency, text]) => {
            const rate = Number(text);

            return Number.isFinite(rate) && rate > 0 ? [[currency, rate]] : [];
        }),
    );

export interface LegacyBalanceTotals {
    readonly netTotalInBase: number;
    readonly owedTotalInBase: number;
    readonly owingTotalInBase: number;
}

/** `summarizeBalances` over legacy entries, with the totals as legacy numbers. */
export const legacySummarizeEntries = (
    entries: readonly BalanceEntry[],
    rates: CurrenciesRates,
    baseCurrency: string,
    targetCurrency: string,
): LegacyBalanceTotals => {
    const summary = summarizeBalances(
        validEntries(entries).map(item => item.net),
        legacyCurrencyOrDefault(targetCurrency),
        legacyRateLookup(rates, baseCurrency),
    );

    return {
        netTotalInBase: legacyAmountFromMoney(summary.net),
        owedTotalInBase: legacyAmountFromMoney(summary.owed),
        owingTotalInBase: legacyAmountFromMoney(summary.owing),
    };
};
