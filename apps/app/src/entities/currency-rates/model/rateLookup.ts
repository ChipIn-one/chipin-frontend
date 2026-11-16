import type { RateLookup } from 'entities/balance';

import type { CurrencyRates } from './types';

/**
 * The snapshot as a `RateLookup` for `summarizeBalances`: both sides are rates against `base`, as
 * decimal text, so a cross rate is computed exactly. `null` when a currency has no rate; a zero or
 * malformed rate is rejected by `summarizeBalances` itself.
 */
export const currencyRateLookup =
    ({ base, rates }: CurrencyRates): RateLookup =>
    (from, to) => {
        const rateOf = (currency: string): string | undefined =>
            currency === base ? '1' : rates[currency];
        const fromRate = rateOf(from);
        const toRate = rateOf(to);

        return fromRate === undefined || toRate === undefined
            ? null
            : { from: fromRate, to: toRate };
    };
