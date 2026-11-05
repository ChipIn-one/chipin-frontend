import { describe, expect, test } from 'vitest';

import { convert } from './convert';
import { currencyCode, fromUnits } from './money';

const USD = currencyCode('USD');
const EUR = currencyCode('EUR');

describe('convert (approximate, half-up to scale 4)', () => {
    test.each([
        [100000n, '0.9', 90000n],
        [100000n, '1', 100000n],
        [1n, '0.5', 1n],
        [-1n, '0.5', -1n],
        [1n, '0.4999', 0n],
        [33333n, '1.23456789', 41152n],
        [-33333n, '1.23456789', -41152n],
        [12345n, '1E+2', 1234500n],
        [12345n, '0', 0n],
        [9999999999999999999n, '2', 19999999999999999998n],
    ])('%s × %s → %s', (minor, rate, expected) => {
        expect(convert(fromUnits(minor, USD), rate, EUR)).toEqual({
            minor: expected,
            currency: 'EUR',
            approx: true,
        });
    });

    test.each(['-1', 'abc', ''])('rate %j throws', rate => {
        expect(() => convert(fromUnits(1n, USD), rate, EUR)).toThrow(RangeError);
    });
});
