import type { BalanceEntry } from 'api/chipin.raw.types';
import {
    legacyEntryFromMoney,
    legacyRatesFromDecimals,
    legacySummarizeEntries,
    partitionBalances,
} from 'entities/balance';
import type { CurrencyRates } from 'entities/currency-rates';
import type { DashboardBalances } from 'entities/dashboard';
import { sortBalancesByCurrency } from 'helpers/currencies';

import type { BadgeItem } from 'basics/BalanceBadges';

/**
 * The dashboard summary: the totals converted into `defaultCurrency` and the per-currency badges,
 * largest converted amount first. The display components still take numbers, hence the legacy
 * bridge.
 */
export const summarizeDashboard = (
    balances: DashboardBalances,
    { base, rates: decimalRates }: CurrencyRates,
    defaultCurrency: string,
) => {
    const rates = legacyRatesFromDecimals(decimalRates);
    const { owed, owe } = partitionBalances(balances, balance => balance);
    const sorted = (list: DashboardBalances): BalanceEntry[] =>
        sortBalancesByCurrency(list.map(legacyEntryFromMoney), rates, base, defaultCurrency);

    return {
        ...legacySummarizeEntries(balances.map(legacyEntryFromMoney), rates, base, defaultCurrency),
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
