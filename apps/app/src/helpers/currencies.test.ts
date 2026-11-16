import { expect, test } from 'vitest';

import { getBalanceDirection } from './currencies';

test.each([0, -0, 5.5e-17, -5.5e-17, 0.00004, -0.00004])(
    'treats %s as a settled balance',
    netBalance => {
        expect(getBalanceDirection(netBalance)).toBe('settled');
    },
);

test.each([
    [0.004, 'owed'],
    [0.0001, 'owed'],
    [12.5, 'owed'],
    [-0.004, 'owe'],
    [-0.0001, 'owe'],
    [-12.5, 'owe'],
] as const)('classifies %s as %s', (netBalance, expected) => {
    expect(getBalanceDirection(netBalance)).toBe(expected);
});
