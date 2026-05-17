import { BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';
import { getCurrencySummary } from 'helpers/currencies';

export const calcBalancesSummary = (
    defaultCurrency: string,
    currenciesRates: CurrenciesRates,
    entity: { balances: BalancesMap },
): {
    owedTotalInBase: number;
    owingTotalInBase: number;
    netTotalInBase: number;
} => {
    const { netTotalInBase, owedTotalInBase, owingTotalInBase } = getCurrencySummary(
        entity.balances,
        currenciesRates,
        defaultCurrency,
    );

    return {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
    };
};
