import type { DashboardStore } from './dashboardStore';
import { APP_MODES } from './dashboardStore';

export const selectIsSoloMode = (s: DashboardStore) => s.appMode === APP_MODES.SOLO;
export const selectAvailableCurrencies = (s: DashboardStore) => Object.keys(s.currencies.rates);
export const selectDefaultCurrency = (s: DashboardStore) => s.currencies.base;
export const selectCurrencyRates = (s: DashboardStore) => s.currencies.rates;
