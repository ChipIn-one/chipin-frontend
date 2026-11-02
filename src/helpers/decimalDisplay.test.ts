import { describe, expect, test } from 'vitest';

import {
    formatPercentDifference,
    formatPercentTotal,
    roundDecimalHalfUp,
    toPlainDecimal,
} from './decimalDisplay';

describe('roundDecimalHalfUp', () => {
    test.each([
        ['9.995', '10', '00'],
        ['99.995', '100', '00'],
        ['0.995', '1', '00'],
    ])('carries across the decimal point for %s', (raw, integer, fraction) => {
        expect(roundDecimalHalfUp(raw, 2)).toEqual({ negative: false, integer, fraction });
    });

    test.each([
        ['1.234', '1', '23'],
        ['1.235', '1', '24'],
        ['-1.235', '1', '24'],
        ['0.000000005', '0', '00000001'],
    ])('rounds %s half away from zero', (raw, integer, fraction) => {
        expect(roundDecimalHalfUp(raw, raw === '0.000000005' ? 8 : 2)).toEqual({
            negative: raw.startsWith('-'),
            integer,
            fraction,
        });
    });

    test('rounds a half to whole digits when places is zero', () => {
        expect(roundDecimalHalfUp('5.5', 0)).toEqual({ negative: false, integer: '6', fraction: '' });
    });

    test.each(['-0.004', '-0', '-0.00000000'])('never returns a negative zero for %s', raw => {
        expect(roundDecimalHalfUp(raw, 2)).toEqual({ negative: false, integer: '0', fraction: '00' });
    });

    test.each([
        ['5', 2, '5', '00'],
        ['007.5', 1, '7', '5'],
    ])('pads the fraction and normalizes leading integer zeros for %s', (raw, places, integer, fraction) => {
        expect(roundDecimalHalfUp(raw, places)).toEqual({ negative: false, integer, fraction });
    });

    test('keeps every digit of very long integers', () => {
        expect(roundDecimalHalfUp('123456789012345678901234567890.5', 0)?.integer).toBe(
            '123456789012345678901234567891',
        );
    });

    test.each(['1.2E-7', '1,5', ' 1', '', '.5', '1.', '+1', 'abc'])(
        'rejects the non-plain decimal %s',
        raw => {
            expect(roundDecimalHalfUp(raw, 2)).toBeNull();
        },
    );

    test.each([-1, 1.5])('rejects places that are not a non-negative integer: %s', places => {
        expect(roundDecimalHalfUp('1.5', places)).toBeNull();
    });
});

describe('toPlainDecimal', () => {
    test.each([
        [96.66999999999999, '96.66999999999999'],
        [0, '0'],
        [-0, '0'],
        [-1.5, '-1.5'],
        [1e-7, '0.0000001'],
        [1.4210854715202004e-14, '0.00000000000001421085'],
        [1e21, '1000000000000000000000'],
    ])('renders %s as the plain decimal %s', (value, expected) => {
        expect(toPlainDecimal(value)).toBe(expected);
    });

    test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        'returns null for the non-finite value %s',
        value => {
            expect(toPlainDecimal(value)).toBeNull();
        },
    );
});

describe('formatPercentTotal', () => {
    test.each([
        [30 + 33.33 + 33.34, '96.67'],
        [40 + 33.33 + 33.34, '106.67'],
        [106.66999999999997, '106.67'],
        [100, '100'],
        [0, '0'],
        [99.994, '99.99'],
        [99.9999, '99.9999'],
        [100.0001, '100.0001'],
        [99.995, '99.995'],
        [99.99999, '< 100'],
        [100.00001, '> 100'],
        [33.33333 + 33.33333 + 33.33333, '< 100'],
    ])('EXP-064 shows the percent total %s as %s without a floating-point tail', (value, expected) => {
        expect(formatPercentTotal(value)).toBe(expected);
    });

    test.each([Number.NaN, Number.POSITIVE_INFINITY])('falls back to zero for %s', value => {
        expect(formatPercentTotal(value)).toBe('0');
    });
});

describe('formatPercentDifference', () => {
    test.each([
        [Math.abs(30 + 33.33 + 33.34 - 100), '3.33'],
        [40 + 33.33 + 33.34 - 100, '6.67'],
        [33.3, '33.3'],
        [100, '100'],
        [0, '0'],
        [-6.669999999999998, '-6.67'],
    ])('EXP-064 shows the percent difference %s as %s', (value, expected) => {
        expect(formatPercentDifference(value)).toBe(expected);
    });

    test.each([0.0001, -0.0001, 1.4210854715202004e-14, 100 - 99.9999])(
        'EXP-064 keeps the non-zero difference %s visible as below the display step',
        value => {
            expect(formatPercentDifference(value)).toBe('< 0.01');
        },
    );

    test('falls back to zero for a non-finite difference', () => {
        expect(formatPercentDifference(Number.NaN)).toBe('0');
    });
});
