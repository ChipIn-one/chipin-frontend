import { expect, test } from 'vitest';

import { getNumberData } from './numbers';

test('formats zero as a valid number', () => {
    expect(getNumberData({ value: 0, precision: 2 }).numberFormatted).toBe('0');
});

test('formats a positive number', () => {
    expect(getNumberData({ value: 12.5, precision: 2 }).numberFormatted).toBe('12.5');
});

test('formats a negative number', () => {
    expect(getNumberData({ value: -12.5, precision: 2 }).numberFormatted).toBe('-12.5');
});

test.each([
    [1.5, 0, '2'],
    [-1.5, 0, '-2'],
    [1.005, 2, '1.01'],
    [-1.005, 2, '-1.01'],
    [2.675, 2, '2.68'],
    [-2.675, 2, '-2.68'],
] as const)('uses symmetric HALF_UP display rounding for %s at precision %s', (value, precision, expected) => {
    const numberData = getNumberData({ value, precision });

    expect(numberData.numberFormatted).toBe(expected);
    expect(numberData.numberString).toBe(expected);
});

test.each([
    [1_000_000_000_000_000.375, '1000000000000000'],
    [-1_000_000_000_000_000.375, '-1000000000000000'],
])('does not round a large non-tie value away from zero: %s', (value, expected) => {
    expect(getNumberData({ value, precision: 0 }).numberString).toBe(expected);
});

test.each([
    [1_000_000_000_000_000.5, '1000000000000001'],
    [-1_000_000_000_000_000.5, '-1000000000000001'],
])('rounds a representable large .5 tie away from zero: %s', (value, expected) => {
    expect(getNumberData({ value, precision: 0 }).numberString).toBe(expected);
});

test('uses explicit precision zero', () => {
    expect(getNumberData({ value: 123.456, precision: 0 }).numberString).toBe('123');
});

test('uses explicit precision two', () => {
    expect(getNumberData({ value: 123.456, precision: 2 }).numberString).toBe('123.46');
});

test('selects automatic precision for ordinary values', () => {
    expect(getNumberData({ value: 1.2345 }).numberFormatted).toBe('1.2345');
});

test('formats a too-small positive value at the minimum precision', () => {
    const numberData = getNumberData({ value: 0.0001, precision: 2 });

    expect(numberData.isValueTooSmall).toBe(true);
    expect(numberData.numberFormatted).toBe('0.01');
});

test('formats thousands with a K suffix', () => {
    expect(getNumberData({ value: 1234, precision: 2, isKMB: true }).numberFormatted).toBe('1.23K');
});

test('formats millions with an M suffix', () => {
    expect(getNumberData({ value: 1_234_567, precision: 2, isKMB: true }).numberFormatted).toBe('1.23M');
});

test('formats billions with a larger KMB suffix', () => {
    expect(getNumberData({ value: 1_234_567_890, precision: 2, isKMB: true }).numberFormatted).toBe('1.23B');
});

test.each([
    [1_000_000_000_000, '1.00T'],
    [1_000_000_000_000_000, '1.00Q'],
])('keeps large KMB suffixes stable at %s', (value, expected) => {
    expect(getNumberData({ value, precision: 0, isKMB: true }).numberFormatted).toBe(expected);
});

test('applies HALF_UP rounding after KMB scaling', () => {
    expect(getNumberData({ value: 2675, precision: 2, isKMB: true }).numberFormatted).toBe('2.68K');
});

test('uses thousands separators without a KMB suffix', () => {
    expect(getNumberData({ value: 1_234_567, precision: 0 }).numberFormatted).toBe('1,234,567');
});

test('preserves trailing zeros in zero-aware formatting', () => {
    const numberData = getNumberData({ value: 12.5, precision: 2, isZeros: true });

    expect(numberData.numberFormatted).toBe('12.50');
    expect(numberData.numberPart).toBe('12.5');
    expect(numberData.zerosPart).toBe('0');
});

test('rounds integer mode to zero decimal places', () => {
    expect(getNumberData({ value: 12.9, isInteger: true }).numberFormatted).toBe('13');
});
