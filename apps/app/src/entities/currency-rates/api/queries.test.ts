import { dehydrate, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { dehydrateOptions } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import { currencyRatesKeys, currencyRatesQueryOptions } from './queries';

const server = setupMswServer();

test("currencyRatesQueryOptions: key ['currencyRates'], staleTime 6 h", () => {
    const options = currencyRatesQueryOptions();

    expect(currencyRatesKeys.all).toEqual(['currencyRates']);
    expect(options.queryKey).toBe(currencyRatesKeys.all);
    expect(options.staleTime).toBe(6 * 60 * 60 * 1000);
});

test('loads USD-based rates without a double and keeps them in the persisted cache', async () => {
    const requests: URL[] = [];

    server.use(
        http.get('*/currency-rates', ({ request }) => {
            requests.push(new URL(request.url));
            return new HttpResponse(
                '{"base":"USD","timestamp":1,"fetchedAt":2,"stale":false,"rates":{"EUR":0.92,"BTC":0.0000123456789012345678}}',
                { headers: { 'Content-Type': 'application/json' } },
            );
        }),
    );
    const client = new QueryClient();

    const rates = await client.fetchQuery(currencyRatesQueryOptions());

    expect(requests[0]?.searchParams.get('base')).toBe('USD');
    expect(rates.rates).toEqual({ EUR: '0.92', BTC: '0.0000123456789012345678' });
    expect(dehydrate(client, dehydrateOptions).queries.map(query => query.queryKey)).toEqual([
        currencyRatesKeys.all,
    ]);
});
