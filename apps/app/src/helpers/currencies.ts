import type { BalanceEntry, CurrenciesRates } from 'api/chipin.raw.types';

import { normalizeApiMoneyAmount } from './numbers';

export type BalanceDirection = 'owed' | 'owe' | 'settled';

// The sign rule of `displaySign` (entities/balance `balanceDirection`) for the number-based
// `basics/DebtAmount`, which cannot import entities; settled only at zero after scale-4 rounding.
export const getBalanceDirection = (netBalance: number): BalanceDirection => {
    const normalized = normalizeApiMoneyAmount(netBalance);

    if (normalized > 0) {
        return 'owed';
    }

    if (normalized < 0) {
        return 'owe';
    }

    return 'settled';
};

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

export const sortBalancesByCurrency = (
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
