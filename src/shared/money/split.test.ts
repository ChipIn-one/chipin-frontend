import { describe, expect, test } from 'vitest';

import { parseDecimal } from './decimal';
import type { Money } from './money';
import { currencyCode, fromUnits, LEDGER_SCALE } from './money';
import { split } from './split';

const USD = currencyCode('USD');

const units = (text: string): bigint => {
    const [integer = '', fraction = ''] = text.replace('-', '').split('.');
    const magnitude = BigInt(`${integer}${fraction.padEnd(LEDGER_SCALE, '0')}`);

    return text.startsWith('-') ? -magnitude : magnitude;
};
const usd = (text: string): Money => fromUnits(units(text), USD);
const entries = (weights: readonly string[]) =>
    weights.map((weight, index) => ({ userId: `u${index}`, weight }));
const shares = (total: string, weights: readonly string[]): string[] =>
    split(usd(total), entries(weights)).map(share => {
        const digits = share.minor.toString().padStart(5, '0');

        return `${digits.slice(0, -4)}.${digits.slice(-4)}`;
    });

describe('split: port of backend distributeAmount (ShareDistribution.kt)', () => {
    test.each([
        // spec 03 §8 vectors
        ['100.0000', ['1', '1', '1'], ['33.3334', '33.3333', '33.3333']],
        ['0.0002', ['1', '1', '1'], ['0.0001', '0.0001', '0.0000']],
        // backend ShareCalculationStrategiesTest: exact remainders 73 / 73 / 0, the tie goes to
        // the earlier entry (EXP-010: the remainder is distributed deterministically).
        ['1.0001', ['1', '45', '100'], ['0.0069', '0.3082', '0.6850']],
        ['100.00', ['1', '1', '2'], ['25.0000', '25.0000', '50.0000']],
        ['10.00', ['0', '1'], ['0.0000', '10.0000']],
        ['0.0001', ['0', '1'], ['0.0000', '0.0001']],
        ['0.0001', ['33.34', '33.33', '33.33'], ['0.0001', '0.0000', '0.0000']],
        ['10.0001', ['1', '1', '1'], ['3.3334', '3.3334', '3.3333']],
        ['123.4567', ['7'], ['123.4567']],
        ['10', ['2', '3'], ['4.0000', '6.0000']],
        ['0', ['1', '1'], ['0.0000', '0.0000']],
        // the decimal(19,4) maximum, beyond Number.MAX_SAFE_INTEGER
        [
            '999999999999999.9999',
            ['1', '1', '1'],
            ['333333333333333.3333', '333333333333333.3333', '333333333333333.3333'],
        ],
        [
            '1000000000.0000',
            ['1', '1', '1'],
            ['333333333.3334', '333333333.3333', '333333333.3333'],
        ],
    ])('%s by %j → %j', (total, weights, expected) => {
        expect(shares(total, weights)).toEqual(expected);
    });

    test('decimal weights are brought to a common integer scale: 1.5:1 = 15:10', () => {
        expect(shares('10.0001', ['1.5', '1'])).toEqual(shares('10.0001', ['15', '10']));
        expect(shares('10.0001', ['1.5', '1'])).toEqual(['6.0001', '4.0000']);
    });

    test('BigDecimal weight forms: trailing zeros, exponent (1E+2 = 100), huge weights', () => {
        expect(shares('10.0001', ['1.50', '1.0'])).toEqual(shares('10.0001', ['15', '10']));
        expect(shares('100.00', ['1E+2', '1', '999999999999999999999'])).toEqual(
            shares('100.00', ['100', '1', '999999999999999999999']),
        );
        expect(shares('100.00', ['1E+2', '1', '999999999999999999999']).length).toBe(3);
    });

    test('the order of entries decides who gets the remainder', () => {
        const forward = split(usd('100'), [
            { userId: 'a', weight: '1' },
            { userId: 'b', weight: '1' },
            { userId: 'c', weight: '1' },
        ]);
        const reversed = split(usd('100'), [
            { userId: 'c', weight: '1' },
            { userId: 'b', weight: '1' },
            { userId: 'a', weight: '1' },
        ]);

        expect(forward.map(share => share.minor)).toEqual([333334n, 333333n, 333333n]);
        expect(reversed.map(share => share.minor)).toEqual([333334n, 333333n, 333333n]);
        // 'a' gets the extra unit only when it comes first.
        expect(forward[0]?.minor).not.toBe(reversed[2]?.minor);
    });

    test('shares keep the currency of the total', () => {
        const jpy = currencyCode('JPY');

        expect(split(fromUnits(100000n, jpy), entries(['1', '2']))).toEqual([
            fromUnits(33333n, jpy),
            fromUnits(66667n, jpy),
        ]);
    });

    test('an empty list is []', () => {
        expect(split(usd('10'), [])).toEqual([]);
    });

    test.each([
        ['zero total weight', ['0', '0']],
        ['negative weight', ['-1', '2']],
        ['malformed weight', ['abc', '1']],
        ['empty weight', ['', '1']],
    ])('%s throws', (_, weights) => {
        expect(() => split(usd('10'), entries(weights))).toThrow(RangeError);
    });

    test('a negative total: exact division works, a remainder fails like the backend check', () => {
        expect(shares('-3.0000', ['1', '1', '1'])).toEqual(['-1.0000', '-1.0000', '-1.0000']);
        expect(() => split(usd('-1.0000'), entries(['1', '1', '1']))).toThrow(RangeError);
    });

    test('1000 seeded random inputs: sum == total, each ≥ 0, deterministic', () => {
        let seed = 20261028;
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };

        for (let index = 0; index < 1000; index += 1) {
            const total = usd(
                `${Math.floor(random() * 1e6)}.${String(Math.floor(random() * 1e4)).padStart(4, '0')}`,
            );
            const count = 1 + Math.floor(random() * 8);
            const weights = Array.from({ length: count }, () =>
                random() < 0.15
                    ? '0'
                    : `${Math.floor(random() * 100)}.${Math.floor(random() * 100)}`,
            );
            if (weights.every(weight => parseDecimal(weight).unscaled === 0n)) {
                weights[0] = '1';
            }
            const result = split(total, entries(weights));

            expect(result.reduce((acc, share) => acc + share.minor, 0n)).toBe(total.minor);
            expect(result.every(share => share.minor >= 0n)).toBe(true);
            weights.forEach((weight, position) => {
                if (parseDecimal(weight).unscaled === 0n) {
                    expect(result[position]?.minor).toBe(0n);
                }
            });
            expect(split(total, entries(weights))).toEqual(result);
        }
    });
});

describe('parseDecimal (BigDecimal(String) grammar)', () => {
    test.each([
        ['1', 1n, 0],
        ['1.50', 150n, 2],
        ['1E+2', 1n, -2],
        ['1e2', 1n, -2],
        ['1.5E-3', 15n, 4],
        ['.5', 5n, 1],
        ['5.', 5n, 0],
        ['-0', 0n, 0],
        ['+7', 7n, 0],
        ['-2.5', -25n, 1],
    ])('%s → %s × 10^-%i', (text, unscaled, scale) => {
        expect(parseDecimal(text)).toEqual({ unscaled, scale });
    });

    test.each(['', '.', 'e2', '1e', '1.2.3', '1,5', 'abc', '1e99999', '1e-1001'])(
        'rejects %j',
        text => {
            expect(() => parseDecimal(text)).toThrow(RangeError);
        },
    );
});
