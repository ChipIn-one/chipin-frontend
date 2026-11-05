// LEGACY BRIDGE (spec 03 §4.1 item 5, §4.4). The legacy `src/api/*` layer still reads money with
// `JSON.parse`, so its DTOs carry amounts as JS numbers (`BalanceEntry.netBalance`,
// `ApiFriendBalance.netAmount`, activity `amount`/`shareAmount`) and rates as numbers. Until a
// store is migrated to the generated types (`WireAmount` → `moneyFromWire`, 03-4a/03-4b and the
// store PRs of §6), these adapters carry those numbers into `Money` and back for the
// number-based display components.
//
// Restrictions: every export is named `legacy*` and takes or returns a legacy DTO shape only; the
// raw number → Money conversion is not exported. ESLint (`money-legacy-bridge`) forbids importing
// `legacy*` names in `src/{app,shared,entities}/**`. Delete each adapter with its last caller.
import type { ExpenseActivityMetadata } from 'api/activity.types';
import type { ApiFriendBalance, BalanceEntry, CurrenciesRates } from 'api/chipin.raw.types';
import type { Money } from 'shared/money';
import { abs, currencyCode, fromUnits, LEDGER_SCALE, sign, sub } from 'shared/money';

import type { Balance } from './balance';
import type { BalancePartition } from './partition';
import { partitionBalances } from './partition';
import type { BalanceSummary, RateLookup } from './summary';
import { summarizeBalances } from './summary';

// The shortest round-trip text of a double (`Number#toString`), optionally with an exponent.
const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;
const SCALE = BigInt(LEDGER_SCALE);

/**
 * A legacy number amount as `Money`: its shortest decimal text rounded half-up (away from zero)
 * to scale 4, the same value `normalizeApiMoneyAmount` gives today.
 *
 * Exactness: a wire literal of scale ≤ 4 with |v| < 1e11 has ≤ 15 significant digits, so
 * `JSON.parse` → `toString` returns that literal and the result equals the wire amount exactly.
 * Above 1e11 the double may already have lost the last digit (spec 03 §4.1 table); the result is
 * then the same as the legacy code shows, no worse. NaN/±Infinity throw.
 */
const moneyFromLegacyNumber = (value: number, currency: string): Money => {
    const match = NUMBER_TEXT.exec(String(value));

    if (!match) {
        throw new RangeError('Legacy amount is not a finite number');
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
    return fromUnits(negative ? -units : units, currencyCode(currency));
};

/** A legacy amount number for the number-based display components (`Amount`, `DebtAmount`). */
export const legacyAmountFromMoney = (money: Money): number => {
    const magnitude = abs(money).minor;
    const unit = 10n ** SCALE;
    const fraction = (magnitude % unit).toString().padStart(LEDGER_SCALE, '0');

    // Exact for |v| < 1e11 (≤ 15 significant digits); the nearest double above.
    return Number(`${sign(money) < 0 ? '-' : ''}${magnitude / unit}.${fraction}`);
};

export const legacyBalanceFromEntry = (entry: BalanceEntry): Balance => ({
    net: moneyFromLegacyNumber(entry.netBalance, entry.currency),
});

export const legacyBalanceFromFriend = (balance: ApiFriendBalance): Balance => ({
    net: moneyFromLegacyNumber(balance.netAmount, balance.currency),
});

export const legacyEntryFromMoney = (money: Money): BalanceEntry => ({
    currency: money.currency,
    netBalance: legacyAmountFromMoney(money),
});

/** Splits legacy entries by `displaySign` of their exact balance. */
export const legacyPartitionEntries = (
    entries: readonly BalanceEntry[],
): BalancePartition<BalanceEntry> =>
    partitionBalances(entries, entry => legacyBalanceFromEntry(entry).net);

/**
 * How an expense changed `userId`'s balance: the payer funded `amount − own share`, a participant
 * owes the own share. `undefined` without a share snapshot (it cannot tell what the payer funded).
 */
export const legacyExpenseBalanceChange = (
    metadata: ExpenseActivityMetadata,
    userId: string,
): Money | undefined => {
    if (!metadata.shares) {
        return undefined;
    }
    const shareAmount = metadata.shares.find(share => share.userId === userId)?.shareAmount ?? 0;
    const share = moneyFromLegacyNumber(shareAmount, metadata.currency);
    const funded =
        metadata.payerId === userId
            ? moneyFromLegacyNumber(metadata.amount, metadata.currency)
            : fromUnits(0n, share.currency);

    return sub(funded, share);
};

/**
 * Rates of the legacy dashboard (`rates[c]` units of `c` per one `base`) as a `RateLookup`: the
 * cross rate `rates[to] / rates[from]` as decimal text. Rates are approximate by nature; the
 * conversion itself is exact half-up (`convert`).
 */
export const legacyRateLookup =
    (rates: CurrenciesRates, baseCurrency: string): RateLookup =>
    (from, to) => {
        const fromRate = from === baseCurrency ? 1 : rates[from];
        const toRate = to === baseCurrency ? 1 : rates[to];

        if (!fromRate || !toRate) {
            return null;
        }
        const rate = toRate / fromRate;

        return Number.isFinite(rate) && rate > 0 ? String(rate) : null;
    };

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
    const summary: BalanceSummary = summarizeBalances(
        entries.map(entry => legacyBalanceFromEntry(entry).net),
        currencyCode(targetCurrency),
        legacyRateLookup(rates, baseCurrency),
    );

    return {
        netTotalInBase: legacyAmountFromMoney(summary.net),
        owedTotalInBase: legacyAmountFromMoney(summary.owed),
        owingTotalInBase: legacyAmountFromMoney(summary.owing),
    };
};
