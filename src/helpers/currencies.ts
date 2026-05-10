import Big from 'bignumber.js';

import type { ApiBalanceEntry } from 'api/chipin.types';

import { parseBigFields } from './numbers';

export interface BalanceEntry {
    currency: string;
    totalOwed: Big | null;
    totalOwing: Big | null;
    netBalance: Big | null;
}

export type BalancesMap = Record<string, BalanceEntry>;

const BALANCE_ENTRY_PATHS = ['*.netBalance', '*.totalOwed', '*.totalOwing'] as const;

export const parseBalancesMap = (raw: Record<string, ApiBalanceEntry>): BalancesMap =>
    parseBigFields<Record<string, ApiBalanceEntry>, BalancesMap>(raw, BALANCE_ENTRY_PATHS);

export const getCurrencySummary = (
    balances: BalancesMap,
    rates: Record<string, number>,
    mainCurrency: string,
): { netTotal: Big; owedTotal: Big; owingTotal: Big } => {
    const entries = Object.values(balances);
    const currencyRate = rates[mainCurrency] ?? 1;

    const sumField = (
        field: keyof Pick<BalanceEntry, 'netBalance' | 'totalOwed' | 'totalOwing'>,
    ): Big =>
        entries.reduce((acc, entry) => {
            const amount = entry[field];

            if (!amount || amount.eq(0)) {
                return acc;
            }

            const rate = rates[entry.currency];

            if (!rate) {
                return acc;
            }

            return acc.plus(amount.dividedBy(rate).multipliedBy(currencyRate));
        }, Big(0));

    return {
        netTotal: sumField('netBalance'),
        owedTotal: sumField('totalOwed'),
        owingTotal: sumField('totalOwing'),
    };
};
