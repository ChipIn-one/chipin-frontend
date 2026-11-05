// Share distribution: an exact port of the backend `distributeAmount` and `toCommonScaleIntegers`
// (chipin-backend `features/ledger/shares/ShareDistribution.kt:22-73`), so a share preview equals
// the shares the backend stores for AUTO (all weights '1'), SHARES and PERCENTAGE.
import type { Decimal } from './decimal';
import { parseDecimal } from './decimal';
import type { ApproxMoney, Money } from './money';
import { fromUnits } from './money';

// toCommonScaleIntegers: scales every weight by the same power of ten so all become integers;
// the ratios, which is all the distribution depends on, are unchanged.
const toCommonScaleIntegers = (weights: readonly Decimal[]): bigint[] => {
    if (weights.some(weight => weight.unscaled < 0n)) {
        throw new RangeError('Weights must not be negative');
    }
    const commonScale = Math.max(0, ...weights.map(weight => weight.scale));

    return weights.map(weight => weight.unscaled * 10n ** BigInt(commonScale - weight.scale));
};

export interface SplitEntry {
    readonly userId: string;
    /** A decimal string: '1' for AUTO, the share weight for SHARES, the percentage for PERCENTAGE. */
    readonly weight: string;
}

/**
 * Splits `total` by `entries` (in the exact order of the request's `participantIds`): each gets
 * floor(units × w / W); the units floor dropped go one each to the largest exact remainders, ties
 * by entry order. Zero weights are allowed; an empty list is `[]`; W ≤ 0 throws. The shares of an
 * `ApproxMoney` total are `ApproxMoney`.
 */
export function split(total: ApproxMoney, entries: readonly SplitEntry[]): ApproxMoney[];
export function split(total: Money, entries: readonly SplitEntry[]): Money[];
export function split(total: Money, entries: readonly SplitEntry[]): Money[] {
    if (entries.length === 0) {
        return [];
    }
    const totalUnits = total.minor;
    const weights = toCommonScaleIntegers(entries.map(entry => parseDecimal(entry.weight)));
    const totalWeight = weights.reduce((acc, weight) => acc + weight, 0n);

    if (totalWeight <= 0n) {
        throw new RangeError('Total weight must be positive');
    }

    // BigInt `/` and `%` truncate toward zero, exactly like BigInteger.divideAndRemainder.
    const allocated = weights.map(weight => (totalUnits * weight) / totalWeight);
    const remainders = weights.map(weight => (totalUnits * weight) % totalWeight);
    const leftover = totalUnits - allocated.reduce((acc, units) => acc + units, 0n);

    // The backend `check`: a negative total that does not divide exactly leaves a negative
    // leftover and fails there too.
    if (leftover < 0n || leftover >= BigInt(entries.length)) {
        throw new RangeError(`Leftover ${leftover} out of range for ${entries.length} entries`);
    }

    // Array#sort is stable: equal remainders keep entry order (Kotlin `sortedByDescending`).
    const byRemainder = remainders
        .map((_, index) => index)
        .sort((left, right) => {
            const difference = (remainders[right] ?? 0n) - (remainders[left] ?? 0n);

            return difference === 0n ? 0 : difference > 0n ? 1 : -1;
        });

    for (const index of byRemainder.slice(0, Number(leftover))) {
        allocated[index] = (allocated[index] ?? 0n) + 1n;
    }

    return allocated.map(units => fromUnits(units, total));
}
