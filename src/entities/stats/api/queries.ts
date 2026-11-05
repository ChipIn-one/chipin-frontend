// Landing statistics (spec 03 §1.3, §6 row 1): the pilot of the key factory + queryOptions
// pattern. Public, not persisted.
import { queryOptions, useQuery } from '@tanstack/react-query';

import { publicApi } from 'shared/api/client';

import { toStats } from '../model/toStats';

const STATS_STALE_TIME = 10 * 60_000;

export const statsKeys = {
    all: ['stats'] as const,
};

export const statsQueryOptions = () =>
    queryOptions({
        queryKey: statsKeys.all,
        staleTime: STATS_STALE_TIME,
        queryFn: ({ signal }) => publicApi('get', '/stats', { signal }).then(toStats),
    });

export const useStatsQuery = () => useQuery(statsQueryOptions());
