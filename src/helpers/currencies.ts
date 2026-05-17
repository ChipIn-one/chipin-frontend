import { BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';

export const getCurrencySummary = (
    balances: BalancesMap,
    rates: CurrenciesRates,
    defaultCurrency: string,
): { netTotalInBase: number; owedTotalInBase: number; owingTotalInBase: number } => {
    const entries = Object.values(balances);
    const currencyRate = rates[defaultCurrency] ?? 1;

    let netTotalInBase = 0;
    let owedTotalInBase = 0;
    let owingTotalInBase = 0;

    for (const entry of entries) {
        const amount = entry.netBalance;

        if (amount === null || amount === 0) {
            continue;
        }

        const rate = rates[entry.currency];

        if (!rate) {
            continue;
        }

        const converted = (amount / rate) * currencyRate;

        netTotalInBase += converted;

        if (amount > 0) {
            owedTotalInBase += converted;
        } else {
            owingTotalInBase += Math.abs(converted);
        }
    }

    return { netTotalInBase, owedTotalInBase, owingTotalInBase };
};
