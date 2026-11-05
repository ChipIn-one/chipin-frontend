import { expect, test } from 'vitest';

import { toStats } from './toStats';

test('toStats maps every counter and drops unknown wire fields', () => {
    const wire = {
        usersCount: 51_234,
        groupsCount: 16_789,
        expensesCount: 25_345_678,
        settlementsCount: 321_987,
        extra: 'ignored',
    };

    expect(toStats(wire)).toEqual({
        usersCount: 51_234,
        groupsCount: 16_789,
        expensesCount: 25_345_678,
        settlementsCount: 321_987,
    });
});
