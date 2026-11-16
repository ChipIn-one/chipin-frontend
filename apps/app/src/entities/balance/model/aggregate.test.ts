import { expect, test } from 'vitest';

import type { Money } from 'shared/money';
import { currencyCode } from 'shared/money';

import { aggregateByCurrency } from './aggregate';

const money = (minor: bigint, currency = 'USD'): Money => ({
    minor,
    currency: currencyCode(currency),
});

const totals = (list: readonly Money[]) =>
    aggregateByCurrency(list, item => item).map(({ total }) => total);

test.each([
    ['empty', [], []],
    [
        'one currency, exact sum (0.1 + 0.2 − 0.3 = 0)',
        [money(1_000n), money(2_000n), money(-3_000n)],
        [money(0n)],
    ],
    ['sub-minor amounts add up exactly', [money(40n), money(1n)], [money(41n)]],
    [
        'mixed currencies in order of first appearance',
        [money(10n, 'EUR'), money(5n), money(-3n, 'EUR'), money(7n, 'JPY'), money(1n, 'KWD')],
        [money(7n, 'EUR'), money(5n), money(7n, 'JPY'), money(1n, 'KWD')],
    ],
] as const)('%s', (_name, input, expected) => {
    expect(totals(input)).toEqual(expected);
});

test('keeps the items of each currency in input order', () => {
    const items = [
        { id: 'a', net: money(1n) },
        { id: 'b', net: money(2n, 'EUR') },
        { id: 'c', net: money(3n) },
    ];

    expect(
        aggregateByCurrency(items, item => item.net).map(({ total, items: group }) => [
            total.currency,
            group.map(item => item.id),
        ]),
    ).toEqual([
        ['USD', ['a', 'c']],
        ['EUR', ['b']],
    ]);
});
