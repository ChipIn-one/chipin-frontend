// Balance partition by sign (spec 03 §4.4): the single "owes / is owed / settled" split.
import type { Money } from 'shared/money';
import { displaySign } from 'shared/money';

export type BalanceDirection = 'owed' | 'owe' | 'settled';

export interface BalancePartition<T> {
    /** You are owed: `displaySign(net) === 1`. */
    readonly owed: T[];
    /** You owe: `displaySign(net) === -1`. */
    readonly owe: T[];
    /** Settled: exactly zero at scale 4. */
    readonly settled: T[];
}

/**
 * Direction of one balance by `displaySign`: settled only at `0n`, so a debt below one minor unit
 * (0.0040 USD, shown "< $0.01") is still a debt, never "settled".
 */
export const balanceDirection = (net: Money): BalanceDirection => {
    const sign = displaySign(net);

    if (sign === 0) {
        return 'settled';
    }
    return sign > 0 ? 'owed' : 'owe';
};

/** Splits items by the sign of their balance; each part keeps the input order. */
export const partitionBalances = <T>(
    items: readonly T[],
    netOf: (item: T) => Money,
): BalancePartition<T> => {
    const partition: BalancePartition<T> = { owed: [], owe: [], settled: [] };

    for (const item of items) {
        partition[balanceDirection(netOf(item))].push(item);
    }
    return partition;
};
