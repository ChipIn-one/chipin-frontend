import type { BalanceEntry, CurrenciesRates } from 'api/chipin.raw.types';
import { getBalanceEntriesSummary } from 'helpers/currencies';

export const calcBalancesSummary = (
    defaultCurrency: string,
    currenciesRates: CurrenciesRates,
    baseCurrency: string,
    entries: BalanceEntry[],
): {
    owedTotalInBase: number;
    owingTotalInBase: number;
    netTotalInBase: number;
} => {
    return getBalanceEntriesSummary(
        entries,
        currenciesRates,
        baseCurrency,
        defaultCurrency,
    );
};
