// Aggregation of balances by currency (spec 03 §4.4): exact sums in ledger units.
import type { CurrencyCode, Money } from 'shared/money';
import { sum } from 'shared/money';

export interface CurrencyTotal<T> {
    /** The exact sum of the items' balances in their currency. */
    readonly total: Money;
    /** The items of this currency, in input order. */
    readonly items: T[];
}

/**
 * Groups items by the currency of their balance and sums each group with `sum`. Groups come in
 * the order each currency first appears; a zero total is kept (the caller decides what it means).
 */
export const aggregateByCurrency = <T>(
    items: readonly T[],
    netOf: (item: T) => Money,
): CurrencyTotal<T>[] => {
    const groups = new Map<CurrencyCode, T[]>();

    for (const item of items) {
        const { currency } = netOf(item);
        const group = groups.get(currency);

        if (group) {
            group.push(item);
        } else {
            groups.set(currency, [item]);
        }
    }

    return Array.from(groups, ([currency, group]) => ({
        total: sum(group.map(netOf), currency),
        items: group,
    }));
};
