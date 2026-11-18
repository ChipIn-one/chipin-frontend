import { createElement, type ReactNode } from 'react';
import { dehydrate, hydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { createQueryClient, PAGE_LOADED_AT, refetchIfRestored } from 'shared/api/queryClient';
import { currencyCode, fromUnits } from 'shared/money';
import { dehydrateOptions } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import { dashboardBalancesQueryOptions, dashboardKeys, useDashboardBalancesQuery } from './queries';

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

test('#724 the balances restored from before the reload are read again on mount', () => {
    expect(dashboardBalancesQueryOptions().refetchOnMount).toBe(refetchIfRestored);
});

test('#724 the dashboard hook shows the balances restored from before a payment, then the server ones', async () => {
    // Only `Date` is faked and it stands still: the snapshot stays younger than the stale time
    // however slow the run is.
    vi.useFakeTimers({ toFake: ['Date'] });
    let served = -50;

    server.use(
        http.get('*/dashboard/balances', () =>
            HttpResponse.json({ balances: { USD: { currency: 'USD', netBalance: served } } }),
        ),
    );
    try {
        // Before the reload: the balances are read and the cache saved, then a payment is
        // recorded and the throttled save never runs.
        vi.setSystemTime(PAGE_LOADED_AT - 800);
        const before = createQueryClient();

        await before.fetchQuery(dashboardBalancesQueryOptions());
        const snapshot = dehydrate(before, dehydrateOptions);

        served = -20;
        // The reload, within the balances' stale time of the snapshot.
        vi.setSystemTime(PAGE_LOADED_AT + 200);
        const after = createQueryClient();

        hydrate(after, snapshot);
        const { result, unmount } = renderHook(() => useDashboardBalancesQuery(), {
            wrapper: ({ children }: { children: ReactNode }) =>
                createElement(QueryClientProvider, { client: after }, children),
        });

        expect(result.current.data).toEqual([fromUnits(-500_000n, currencyCode('USD'))]);
        expect(result.current.isFetching).toBe(true);
        await waitFor(() => {
            expect(result.current.data).toEqual([fromUnits(-200_000n, currencyCode('USD'))]);
        });
        unmount();
    } finally {
        vi.useRealTimers();
    }
});
