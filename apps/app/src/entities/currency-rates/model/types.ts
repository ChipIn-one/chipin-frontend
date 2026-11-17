/**
 * The latest exchange-rate snapshot (`GET /currency-rates`): one `base` unit buys `rates[c]` units
 * of `c`. Rates stay decimal text, never a double.
 */
export interface CurrencyRates {
    /** ISO 4217 code of the base currency. */
    readonly base: string;
    /** Decimal text keyed by ISO 4217 code. */
    readonly rates: Readonly<Record<string, string>>;
    /** Provider snapshot time, Unix seconds. */
    readonly timestamp: number;
    /** Backend fetch time, Unix seconds. */
    readonly fetchedAt: number;
    /** The provider refresh failed and the snapshot is the last cached one. */
    readonly stale: boolean;
}
