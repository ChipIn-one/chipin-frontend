import type { components } from 'shared/api/generated/schema';

import type { CurrencyRates } from './types';

type CurrencyRatesResponse = components['schemas']['CurrencyRatesResponse'];

/** `CurrencyRatesResponse` (wire) → `CurrencyRates` (domain); rates keep their decimal text. */
export const toCurrencyRates = (response: CurrencyRatesResponse): CurrencyRates => ({
    base: response.base,
    rates: { ...response.rates },
    timestamp: response.timestamp,
    fetchedAt: response.fetchedAt,
    stale: response.stale,
});
