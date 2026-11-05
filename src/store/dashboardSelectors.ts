import { legacyPartitionEntries, legacySummarizeEntries } from 'entities/balance';
import { sortBalancesByCurrency } from 'helpers/currencies';

import type { DashboardStore } from './dashboardStore';
import { APP_MODES } from './dashboardStore';

export const selectIsSoloMode = (s: DashboardStore) => s.appMode === APP_MODES.SOLO;
export const selectAvailableCurrencies = (s: DashboardStore) => Object.keys(s.currencies.rates);
export const selectDefaultCurrency = (s: DashboardStore) => s.currencies.base;
export const selectCurrencyRates = (s: DashboardStore) => s.currencies.rates;

export const selectDashboardSummary = (
    state: Pick<DashboardStore, 'balances' | 'currencies'>,
    defaultCurrency: string,
) => {
    const entries = Object.values(state.balances);
    const { owed, owe } = legacyPartitionEntries(entries);
    const totals = legacySummarizeEntries(
        entries,
        state.currencies.rates,
        state.currencies.base,
        defaultCurrency,
    );

    return {
        owedEntries: sortBalancesByCurrency(
            owed,
            state.currencies.rates,
            state.currencies.base,
            defaultCurrency,
        ),
        oweEntries: sortBalancesByCurrency(
            owe,
            state.currencies.rates,
            state.currencies.base,
            defaultCurrency,
        ),
        ...totals,
    };
};
