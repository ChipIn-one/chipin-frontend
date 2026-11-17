import type { BalanceEntry } from 'api/chipin.raw.types';
import {
    legacyAmountFromMoney,
    legacyCurrencyOrDefault,
    legacyEntryFromMoney,
    legacyRatesFromDecimals,
    partitionBalances,
    summarizeBalances,
} from 'entities/balance';
import type { CurrencyRates } from 'entities/currency-rates';
import { currencyRateLookup } from 'entities/currency-rates';
import type { DashboardBalances } from 'entities/dashboard';
import { sortBalancesByCurrency } from 'helpers/currencies';

import type { BadgeItem } from 'basics/BalanceBadges';

/**
 * The dashboard summary: the totals converted into `defaultCurrency` (exact, from `Money`) and the
 * per-currency badges, largest converted amount first. The display components still take numbers,
 * hence the legacy bridge at the end.
 */
export const summarizeDashboard = (
    balances: DashboardBalances,
    currencyRates: CurrencyRates,
    defaultCurrency: string,
) => {
    const { base } = currencyRates;
    // The totals are exact `Money`; only the number-based display reads them as numbers.
    const totals = summarizeBalances(
        balances,
        legacyCurrencyOrDefault(defaultCurrency),
        currencyRateLookup(currencyRates),
    );
    // The badge order still uses the number-based sort of `helpers/currencies`.
    const rates = legacyRatesFromDecimals(currencyRates.rates);
    const { owed, owe } = partitionBalances(balances, balance => balance);
    const sorted = (list: DashboardBalances): BalanceEntry[] =>
        sortBalancesByCurrency(list.map(legacyEntryFromMoney), rates, base, defaultCurrency);

    return {
        netTotalInBase: legacyAmountFromMoney(totals.net),
        owedTotalInBase: legacyAmountFromMoney(totals.owed),
        owingTotalInBase: legacyAmountFromMoney(totals.owing),
        owedBadgeItems: sorted(owed).map<BadgeItem>(entry => ({
            tokenCode: entry.currency,
            value: entry.netBalance,
            color: 'grass',
        })),
        oweBadgeItems: sorted(owe).map<BadgeItem>(entry => ({
            tokenCode: entry.currency,
            value: Math.abs(entry.netBalance),
            color: 'tomato',
        })),
    };
};
