// Currency rates (spec 03 §1.2, §6 row 2): the backend refreshes them every 12 h, so they stay
// fresh for 6 h. Persisted with the user's cache.
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from 'shared/api/client';

import { toCurrencyRates } from '../model/toCurrencyRates';
import type { CurrencyRates } from '../model/types';

const CURRENCY_RATES_STALE_TIME = 6 * 60 * 60_000;
// The base the legacy summaries convert through (`rates[c]` per one USD).
const RATES_BASE = 'USD';

/** Before the first response: no rates, so nothing converts and no currency is offered. */
export const EMPTY_CURRENCY_RATES: CurrencyRates = {
    base: RATES_BASE,
    rates: {},
    timestamp: 0,
    fetchedAt: 0,
    stale: false,
};

export const currencyRatesKeys = {
    all: ['currencyRates'] as const,
};

export const currencyRatesQueryOptions = () =>
    queryOptions({
        queryKey: currencyRatesKeys.all,
        staleTime: CURRENCY_RATES_STALE_TIME,
        queryFn: ({ signal }) =>
            api('get', '/currency-rates', { query: { base: RATES_BASE }, signal }).then(
                toCurrencyRates,
            ),
    });

export const useCurrencyRatesQuery = () => useQuery(currencyRatesQueryOptions());
