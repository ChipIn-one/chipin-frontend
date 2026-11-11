import { dehydrate, QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { dehydrateOptions } from 'shared/offline/queryPersister';

import type { Stats } from '../model/types';

import { statsKeys, statsQueryOptions } from './queries';

const stats: Stats = {
    expensesCount: 1,
    debtsTracked: fromUnits(20_000n, currencyCode('USD')),
    activeGroupsCount: 3,
    peopleSharingCount: 4,
};

test("statsQueryOptions: key ['stats'], staleTime 10 min, a query function", () => {
    const options = statsQueryOptions();

    expect(statsKeys.all).toEqual(['stats']);
    expect(options.queryKey).toBe(statsKeys.all);
    expect(options.staleTime).toBe(10 * 60 * 1000);
    expect(typeof options.queryFn).toBe('function');
});

test("['stats'] is marked persist: false and is not dehydrated into the persisted cache", async () => {
    const client = new QueryClient();

    await client.prefetchQuery({ ...statsQueryOptions(), queryFn: () => stats });

    expect(statsQueryOptions().meta).toEqual({ persist: false });
    expect(client.getQueryData(statsKeys.all)).toEqual(stats);
    expect(dehydrate(client, dehydrateOptions).queries).toEqual([]);
});
