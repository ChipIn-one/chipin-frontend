import { sortBalancesByCurrency } from 'helpers/currencies';

import { calcBalancesSummary } from './commonSelectors';
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
    const owedEntries = [];
    const oweEntries = [];

    for (const entry of entries) {
        if (entry.netBalance > 0) {
            owedEntries.push(entry);
        } else if (entry.netBalance < 0) {
            oweEntries.push(entry);
        }
    }

    const totals = calcBalancesSummary(
        defaultCurrency,
        state.currencies.rates,
        state.currencies.base,
        entries,
    );

    return {
        owedEntries: sortBalancesByCurrency(
            owedEntries,
            state.currencies.rates,
            state.currencies.base,
            defaultCurrency,
        ),
        oweEntries: sortBalancesByCurrency(
            oweEntries,
            state.currencies.rates,
            state.currencies.base,
            defaultCurrency,
        ),
        ...totals,
    };
};
