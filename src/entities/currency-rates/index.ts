// Public entry of entities/currency-rates: the exchange-rate snapshot query.
export {
    currencyRatesKeys,
    currencyRatesQueryOptions,
    EMPTY_CURRENCY_RATES,
    useCurrencyRatesQuery,
} from './api/queries';
export { currencyRateLookup } from './model/rateLookup';
export type { CurrencyRates } from './model/types';
