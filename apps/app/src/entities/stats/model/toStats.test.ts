import { expect, test } from 'vitest';

import { createWireAmount, currencyCode, fromUnits } from 'shared/money';

import { toStats } from './toStats';

test('toStats maps the four metrics, reads debtsTrackedUsd as exact USD Money, drops unknown fields', () => {
    const wire = {
        expensesCount: 25_345_678,
        debtsTrackedUsd: createWireAmount('1250000.5'),
        activeGroupsCount: 1_800,
        peopleSharingCount: 51_234,
        extra: 'ignored',
    };

    expect(toStats(wire)).toEqual({
        expensesCount: 25_345_678,
        debtsTracked: fromUnits(12_500_005_000n, currencyCode('USD')),
        activeGroupsCount: 1_800,
        peopleSharingCount: 51_234,
    });
});

test('toStats rejects a malformed debtsTrackedUsd instead of showing an invented value', () => {
    expect(() =>
        toStats({
            expensesCount: 1,
            debtsTrackedUsd: createWireAmount('1.23456'),
            activeGroupsCount: 1,
            peopleSharingCount: 1,
        }),
    ).toThrow();
});
