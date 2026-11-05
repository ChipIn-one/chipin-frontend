import { describe, expect, test } from 'vitest';

import type { Money } from 'shared/money';
import { currencyCode } from 'shared/money';

import { balanceDirection, partitionBalances } from './partition';

const money = (minor: bigint, currency = 'USD'): Money => ({
    minor,
    currency: currencyCode(currency),
});

describe('balanceDirection', () => {
    test.each([
        ['positive', money(15_000n), 'owed'],
        ['negative', money(-15_000n), 'owe'],
        ['zero', money(0n), 'settled'],
        ['sub-minor USD debt to you (0.0040)', money(40n), 'owed'],
        ['sub-minor USD debt of yours (-0.0001)', money(-1n), 'owe'],
        ['sub-minor JPY (0 minor units, 0.4)', money(4_000n, 'JPY'), 'owed'],
        ['sub-minor KWD (3 minor units, -0.0004)', money(-4n, 'KWD'), 'owe'],
    ] as const)('%s → %s', (_name, net, expected) => {
        expect(balanceDirection(net)).toBe(expected);
    });
});

describe('partitionBalances', () => {
    test('splits by sign, settled only at exactly zero, keeping input order', () => {
        const items = [
            { id: 'a', net: money(10_000n) },
            { id: 'b', net: money(-1n, 'EUR') },
            { id: 'c', net: money(0n, 'GBP') },
            { id: 'd', net: money(40n, 'JPY') },
            { id: 'e', net: money(-25_000n, 'KWD') },
        ];

        const { owed, owe, settled } = partitionBalances(items, item => item.net);

        expect(owed.map(item => item.id)).toEqual(['a', 'd']);
        expect(owe.map(item => item.id)).toEqual(['b', 'e']);
        expect(settled.map(item => item.id)).toEqual(['c']);
    });

    test('an empty list gives empty parts', () => {
        expect(partitionBalances([], (net: Money) => net)).toEqual({
            owed: [],
            owe: [],
            settled: [],
        });
    });
});
