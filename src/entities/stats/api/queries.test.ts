import { expect, test } from 'vitest';

import { statsKeys, statsQueryOptions } from './queries';

test("statsQueryOptions: key ['stats'], staleTime 10 min, a query function", () => {
    const options = statsQueryOptions();

    expect(statsKeys.all).toEqual(['stats']);
    expect(options.queryKey).toBe(statsKeys.all);
    expect(options.staleTime).toBe(10 * 60 * 1000);
    expect(typeof options.queryFn).toBe('function');
});
