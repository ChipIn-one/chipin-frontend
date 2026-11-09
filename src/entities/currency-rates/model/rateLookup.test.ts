import { expect, test } from 'vitest';

import { currencyCode } from 'shared/money';

import { currencyRateLookup } from './rateLookup';

const rateOf = currencyRateLookup({
    base: 'USD',
    timestamp: 1,
    fetchedAt: 1,
    stale: false,
    rates: { EUR: '0.9', JPY: '150.25' },
});
const code = currencyCode;

test('pairs both rates against the base as decimal text; the base itself is 1', () => {
    expect(rateOf(code('EUR'), code('JPY'))).toEqual({ from: '0.9', to: '150.25' });
    expect(rateOf(code('EUR'), code('USD'))).toEqual({ from: '0.9', to: '1' });
    expect(rateOf(code('USD'), code('EUR'))).toEqual({ from: '1', to: '0.9' });
});

test('a currency without a rate gives no rate', () => {
    expect(rateOf(code('GBP'), code('USD'))).toBeNull();
    expect(rateOf(code('USD'), code('GBP'))).toBeNull();
});
