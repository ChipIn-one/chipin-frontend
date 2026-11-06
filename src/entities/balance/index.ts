// Public entry of entities/balance (spec 03 §4.4): partition by sign, aggregation by currency,
// the multi-currency summary, and the legacy bridge for not-yet-migrated stores.
export type { CurrencyTotal } from './model/aggregate';
export { aggregateByCurrency } from './model/aggregate';
export type { LegacyBalanceTotals } from './model/legacy';
export {
    legacyAmountFromMoney,
    legacyBalanceFromEntry,
    legacyCurrencyOrDefault,
    legacyEntryFromMoney,
    legacyExpenseBalanceChange,
    legacyPartitionEntries,
    legacyRateLookup,
    legacyRatesFromDecimals,
    legacySumEntriesByCurrency,
    legacySummarizeEntries,
} from './model/legacy';
export type { BalanceDirection, BalancePartition } from './model/partition';
export { balanceDirection, partitionBalances } from './model/partition';
export type { BalanceSummary, Rate, RateLookup } from './model/summary';
export { summarizeBalances } from './model/summary';
export type { Balance } from './model/types';
