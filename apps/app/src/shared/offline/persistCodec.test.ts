import { describe, expect, test } from 'vitest';

import {
    createWireAmount,
    currencyCode,
    fromUnits,
    isWireAmount,
    wireAmountText,
} from 'shared/money';

import { persistCodec } from './persistCodec';

const roundTrip = (value: unknown): unknown => persistCodec.parse(persistCodec.stringify(value));

describe('persistCodec', () => {
    test('Money { minor: 9999999999999999999n } survives stringify → parse as a bigint (C1-05)', () => {
        const money = fromUnits(9999999999999999999n, currencyCode('USD'));

        const restored = roundTrip({ balance: money });

        expect(restored).toEqual({ balance: money });
        expect(restored).toHaveProperty('balance.minor', 9999999999999999999n);
    });

    test('negative and zero bigints round-trip', () => {
        expect(roundTrip([-42n, 0n])).toEqual([-42n, 0n]);
    });

    test('a non-tag object with a $bigint key stays an object', () => {
        expect(roundTrip({ $bigint: '12', other: 1 })).toEqual({ $bigint: '12', other: 1 });
        expect(roundTrip({ $bigint: '1.5' })).toEqual({ $bigint: '1.5' });
    });

    test('a WireAmount comes back as a frozen WireAmount with the same literal', () => {
        const restored = roundTrip({ amount: createWireAmount('85.5000') });

        expect(restored).toHaveProperty('amount');
        const amount: unknown =
            typeof restored === 'object' && restored !== null && 'amount' in restored
                ? restored.amount
                : undefined;
        expect(isWireAmount(amount)).toBe(true);
        expect(Object.isFrozen(amount)).toBe(true);
        if (isWireAmount(amount)) {
            expect(wireAmountText(amount)).toBe('85.5000');
        }
    });

    test('malformed text throws', () => {
        expect(() => persistCodec.parse('{not json')).toThrow();
    });
});
