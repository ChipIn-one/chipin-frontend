import { BalanceEntry, BalancesMap, CurrenciesRates } from 'api/chipin.raw.types';

export const convertCurrencyAmount = (
    amount: number,
    sourceCurrency: string,
    targetCurrency: string,
    rates: CurrenciesRates,
    baseCurrency: string,
): number | null => {
    const sourceRate = sourceCurrency === baseCurrency ? 1 : rates[sourceCurrency];
    const targetRate = targetCurrency === baseCurrency ? 1 : rates[targetCurrency];

    if (!sourceRate || !targetRate) {
        return null;
    }

    return (amount / sourceRate) * targetRate;
};

export const getCurrencySummary = (
    balances: BalancesMap,
    rates: CurrenciesRates,
    baseCurrency: string,
    defaultCurrency: string,
): { netTotalInBase: number; owedTotalInBase: number; owingTotalInBase: number } => {
    const entries = Object.values(balances);

    let netTotalInBase = 0;
    let owedTotalInBase = 0;
    let owingTotalInBase = 0;

    for (const entry of entries) {
        const amount = entry.netBalance;

        if (amount === null || amount === 0) {
            continue;
        }

        const converted = convertCurrencyAmount(
            amount,
            entry.currency,
            defaultCurrency,
            rates,
            baseCurrency,
        );

        if (converted === null) {
            continue;
        }

        netTotalInBase += converted;

        if (amount > 0) {
            owedTotalInBase += converted;
        } else {
            owingTotalInBase += Math.abs(converted);
        }
    }

    return { netTotalInBase, owedTotalInBase, owingTotalInBase };
};

export const sortBalanceEntriesByConvertedValue = (
    entries: BalanceEntry[],
    rates: CurrenciesRates,
    baseCurrency: string,
    targetCurrency: string,
): BalanceEntry[] =>
    entries
        .map((entry, index) => ({
            entry,
            index,
            convertedValue: convertCurrencyAmount(
                Math.abs(entry.netBalance || 0),
                entry.currency,
                targetCurrency,
                rates,
                baseCurrency,
            ),
        }))
        .sort((leftEntry, rightEntry) => {
            if (leftEntry.convertedValue === null && rightEntry.convertedValue === null) {
                return leftEntry.index - rightEntry.index;
            }

            if (leftEntry.convertedValue === null) {
                return 1;
            }

            if (rightEntry.convertedValue === null) {
                return -1;
            }

            return rightEntry.convertedValue - leftEntry.convertedValue;
        })
        .map(({ entry }) => entry);
