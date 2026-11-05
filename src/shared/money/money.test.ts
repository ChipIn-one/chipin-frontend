import { describe, expect, test } from 'vitest';

import type { ApproxMoney, Money } from './money';
import {
    abs,
    add,
    compare,
    currencyCode,
    CurrencyMismatchError,
    displaySign,
    divideHalfUp,
    fromUnits,
    isApprox,
    isZero,
    LEDGER_SCALE,
    minorUnits,
    negate,
    roundToMinor,
    sign,
    sub,
    sum,
    toUnits,
    unitsToDecimal,
} from './money';

const USD = currencyCode('USD');
const EUR = currencyCode('EUR');
const JPY = currencyCode('JPY');
const KWD = currencyCode('KWD');

/** "1.0050" → 10050n ledger units (test helper; decimals with up to 4 fraction digits). */
const units = (text: string): bigint => {
    const [integer = '', fraction = ''] = text.replace('-', '').split('.');
    const magnitude = BigInt(`${integer}${fraction.padEnd(LEDGER_SCALE, '0')}`);

    return text.startsWith('-') ? -magnitude : magnitude;
};
const usd = (text: string): Money => fromUnits(units(text), USD);

describe('currencyCode', () => {
    test.each([
        ['usd', 'USD'],
        ['Jpy', 'JPY'],
        ['KWD', 'KWD'],
    ])('%s → %s', (input, expected) => {
        expect(currencyCode(input)).toBe(expected);
    });

    // 'uß' upper-cases to 'USS': the input is checked before upper-casing.
    test.each(['', 'US', 'USDT', 'U1D', ' USD', 'ÜSD', 'uß', 'ﬀx'])('rejects %j', input => {
        expect(() => currencyCode(input)).toThrow(RangeError);
    });
});

describe('minorUnits (ISO 4217 table, not Intl)', () => {
    test.each([
        ...['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND'].map(
            code => [code, 0] as const,
        ),
        ...['VUV', 'XAF', 'XOF', 'XPF'].map(code => [code, 0] as const),
        ...['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].map(code => [code, 3] as const),
        ...['USD', 'EUR', 'RUB', 'BRL', 'GBP', 'XYZ'].map(code => [code, 2] as const),
    ])('%s → %i', (code, expected) => {
        expect(minorUnits(currencyCode(code))).toBe(expected);
    });
});

describe('units', () => {
    test('toUnits/fromUnits round-trip', () => {
        const money = fromUnits(855000n, USD);

        expect(money).toEqual({ minor: 855000n, currency: 'USD' });
        expect(toUnits(money)).toBe(855000n);
    });

    test.each([
        [855000n, '85.5000'],
        [0n, '0.0000'],
        [1n, '0.0001'],
        [-1n, '-0.0001'],
        [-855000n, '-85.5000'],
        [9999999999999999999n, '999999999999999.9999'],
    ])('unitsToDecimal(%s, 4) → %s', (value, expected) => {
        expect(unitsToDecimal(value, 4)).toBe(expected);
    });

    test('unitsToDecimal at scale 0', () => {
        expect(unitsToDecimal(-42n, 0)).toBe('-42');
    });
});

describe('arithmetic', () => {
    test.each([
        ['1.5000', '2.2500', '3.7500', '-0.7500'],
        ['-1.0000', '0.0001', '-0.9999', '-1.0001'],
        ['0', '0', '0', '0'],
    ])('%s ± %s', (left, right, total, difference) => {
        expect(add(usd(left), usd(right))).toEqual(usd(total));
        expect(sub(usd(left), usd(right))).toEqual(usd(difference));
    });

    test('negate and abs', () => {
        expect(negate(usd('1.2345'))).toEqual(usd('-1.2345'));
        expect(negate(usd('0'))).toEqual(usd('0'));
        expect(Object.is(negate(usd('0')).minor, 0n)).toBe(true);
        expect(abs(usd('-1.2345'))).toEqual(usd('1.2345'));
        expect(abs(usd('1.2345'))).toEqual(usd('1.2345'));
    });

    test('sum: empty is zero in the given currency', () => {
        expect(sum([], EUR)).toEqual(fromUnits(0n, EUR));
        expect(sum([usd('1.0001'), usd('2.0002'), usd('-0.0003')], USD)).toEqual(usd('3.0000'));
    });

    test.each([
        ['add', () => add(usd('1'), fromUnits(1n, EUR))],
        ['sub', () => sub(usd('1'), fromUnits(1n, EUR))],
        ['compare', () => compare(usd('1'), fromUnits(1n, EUR))],
        ['sum', () => sum([usd('1')], EUR)],
    ])('%s: a currency mismatch throws', (_, run) => {
        expect(run).toThrow(CurrencyMismatchError);
    });

    test.each([
        ['1.0000', '2.0000', -1],
        ['2.0000', '1.0000', 1],
        ['-0.0001', '-0.0001', 0],
    ])('compare(%s, %s) → %i', (left, right, expected) => {
        expect(compare(usd(left), usd(right))).toBe(expected);
    });

    test.each([
        ['0', 0, true],
        ['0.0001', 1, false],
        ['-0.0001', -1, false],
    ])('sign/isZero(%s)', (value, expectedSign, expectedZero) => {
        expect(sign(usd(value))).toBe(expectedSign);
        expect(isZero(usd(value))).toBe(expectedZero);
    });
});

describe('roundToMinor (half-up away from zero, result at scale 4)', () => {
    test.each([
        ['USD', '1.0050', '1.0100'],
        ['USD', '-1.0050', '-1.0100'],
        ['USD', '2.6750', '2.6800'],
        ['USD', '-2.6750', '-2.6800'],
        ['USD', '1.0049', '1.0000'],
        ['USD', '-1.0049', '-1.0000'],
        ['USD', '0.0040', '0.0000'],
        ['USD', '0.0050', '0.0100'],
        ['USD', '-0.0050', '-0.0100'],
        ['JPY', '0.5000', '1.0000'],
        ['JPY', '-0.5000', '-1.0000'],
        ['JPY', '10.4999', '10.0000'],
        ['KWD', '1.2345', '1.2350'],
        ['KWD', '-1.2345', '-1.2350'],
        ['KWD', '1.2344', '1.2340'],
        ['USD', '999999999999999.9950', '1000000000000000.0000'],
    ])('%s %s → %s', (code, value, expected) => {
        const currency = currencyCode(code);

        expect(roundToMinor(fromUnits(units(value), currency))).toEqual(
            fromUnits(units(expected), currency),
        );
    });

    test.each([
        [5n, 10n, 1n],
        [-5n, 10n, -1n],
        [4n, 10n, 0n],
        [-4n, 10n, 0n],
        [15n, 10n, 2n],
        [-15n, 10n, -2n],
    ])('divideHalfUp(%s, %s) → %s', (value, divisor, expected) => {
        expect(divideHalfUp(value, divisor)).toBe(expected);
    });
});

describe('displaySign: settled only at minor === 0n', () => {
    test.each([
        ['0.0000', 0],
        ['0.0040', 1],
        ['-0.0049', -1],
        ['0.0001', 1],
        ['-12.5000', -1],
    ])('%s USD → %i', (value, expected) => {
        expect(displaySign(usd(value))).toBe(expected);
    });

    test('JPY and KWD use the same scale-4 rule', () => {
        expect(displaySign(fromUnits(1n, JPY))).toBe(1);
        expect(displaySign(fromUnits(-1n, KWD))).toBe(-1);
    });
});

describe('ApproxMoney survives arithmetic', () => {
    const approx: ApproxMoney = { ...usd('1.0000'), approx: true };

    test.each([
        ['add(approx, exact)', () => add(approx, usd('1'))],
        ['add(exact, approx)', () => add(usd('1'), approx)],
        ['sub(approx, exact)', () => sub(approx, usd('1'))],
        ['sub(exact, approx)', () => sub(usd('1'), approx)],
        ['negate', () => negate(approx)],
        ['abs', () => abs(negate(approx))],
        ['roundToMinor', () => roundToMinor(approx)],
        ['sum', () => sum([usd('1'), approx], USD)],
        ['fromUnits(units, approx)', () => fromUnits(5n, approx)],
    ])('%s is approximate at runtime', (_, run) => {
        expect(isApprox(run())).toBe(true);
    });

    test('fromUnits takes the currency of its template', () => {
        expect(fromUnits(5n, approx)).toEqual({ minor: 5n, currency: USD, approx: true });
        expect(fromUnits(5n, usd('1'))).toEqual({ minor: 5n, currency: USD });
        expect(isApprox(fromUnits(5n, usd('1')))).toBe(false);
    });

    test('exact inputs stay exact', () => {
        expect(isApprox(add(usd('1'), usd('2')))).toBe(false);
        expect(add(usd('1'), usd('2'))).toEqual(usd('3'));
        expect(isApprox(sum([usd('1')], USD))).toBe(false);
    });
});
