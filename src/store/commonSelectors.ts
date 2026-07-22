import type { BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import { getBalanceEntriesSummary } from 'helpers/currencies';

export const calcBalancesSummary = (
    defaultCurrency: string,
    currenciesRates: CurrenciesRates,
    baseCurrency: string,
    entity: { balances: BalancesMap },
): {
    owedTotalInBase: number;
    owingTotalInBase: number;
    netTotalInBase: number;
} => {
    return getBalanceEntriesSummary(
        Object.values(entity.balances),
        currenciesRates,
        baseCurrency,
        defaultCurrency,
    );
};
