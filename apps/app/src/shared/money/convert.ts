// Currency conversion for display summaries (spec 03 §4.2): approximate by nature (rates).
import { parseDecimal } from './decimal';
import type { ApproxMoney, CurrencyCode, Money } from './money';
import { divideHalfUp, fromUnits } from './money';

/** `money × rate` in `target`, half-up to scale 4. `rate` is a decimal string (a wire rate). */
export const convert = (money: Money, rate: string, target: CurrencyCode): ApproxMoney => {
    const { unscaled, scale } = parseDecimal(rate);

    if (unscaled < 0n) {
        throw new RangeError('Rate must not be negative');
    }
    const product = money.minor * unscaled;
    const minor =
        scale >= 0 ? divideHalfUp(product, 10n ** BigInt(scale)) : product * 10n ** BigInt(-scale);

    return { ...fromUnits(minor, target), approx: true };
};
