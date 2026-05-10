import { DashboardStore } from './dashboardStore';

export const selectAvailableCurrencies = (s: DashboardStore) => Object.keys(s.currencies.rates);
export const selectDefaultCurrency = (s: DashboardStore) => s.currencies.base;
export const selectCurrencyRates = (s: DashboardStore) => s.currencies.rates;
export const selectBalances = (s: DashboardStore) => s.balances;
export const selectOwedEntries = (s: DashboardStore) =>
    Object.values(s.balances).filter(entry => entry.totalOwed?.gt(0));
export const selectOweEntries = (s: DashboardStore) =>
    Object.values(s.balances).filter(entry => entry.totalOwing?.gt(0));
