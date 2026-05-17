import { DashboardStore } from './dashboardStore';

export const selectAvailableCurrencies = (s: DashboardStore) => Object.keys(s.currencies.rates);
export const selectDefaultCurrency = (s: DashboardStore) => s.currencies.base;
export const selectCurrencyRates = (s: DashboardStore) => s.currencies.rates;
