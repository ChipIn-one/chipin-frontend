import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { setupMswServer } from 'test/mswServer';

import { dashboardBalancesQueryOptions, dashboardKeys } from './queries';

const server = setupMswServer();

test("dashboard keys share the 'dashboard' root and stay fresh for 30 s", () => {
    expect(dashboardKeys.all).toEqual(['dashboard']);
    expect(dashboardKeys.balances()).toEqual(['dashboard', 'balances']);
    expect(dashboardBalancesQueryOptions().staleTime).toBe(30_000);
});

test('loads the balance totals through the lossless transport as Money', async () => {
    server.use(
        http.get(
            '*/dashboard/balances',
            () =>
                new HttpResponse(
                    '{"balances":{"USD":{"currency":"USD","netBalance":365963032346.3555}}}',
                    { headers: { 'Content-Type': 'application/json' } },
                ),
        ),
    );

    await expect(new QueryClient().fetchQuery(dashboardBalancesQueryOptions())).resolves.toEqual([
        fromUnits(3_659_630_323_463_555n, currencyCode('USD')),
    ]);
});
