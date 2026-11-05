import * as Sentry from '@sentry/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { convert } from './convert';
import type { Money } from './money';
import { currencyCode, fromUnits } from './money';
import { createWireAmount, isWireAmount, MoneyWireError, wireAmountText } from './wire';
import { mapItems, moneyFromWire, moneyToWire, resetReportedItems } from './wireMoney';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

const USD = currencyCode('USD');
const fromText = (text: string): Money => moneyFromWire(createWireAmount(text), USD);

beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
    resetReportedItems();
});

describe('WireAmount', () => {
    test('is a frozen plain object that survives JSON and structured clone', () => {
        const amount = createWireAmount('85.5000');

        expect(Object.isFrozen(amount)).toBe(true);
        expect(isWireAmount(amount)).toBe(true);
        expect(isWireAmount(JSON.parse(JSON.stringify(amount)))).toBe(true);
        expect(isWireAmount(structuredClone(amount))).toBe(true);
        expect(wireAmountText(amount)).toBe('85.5000');
    });

    test.each([null, undefined, 85.5, '85.5', {}, { __wireDecimal: 85.5 }])(
        'isWireAmount(%j) is false',
        value => {
            expect(isWireAmount(value)).toBe(false);
        },
    );
});

describe('moneyFromWire (spec 03 §8 vectors)', () => {
    test.each([
        ['85.5000', 855000n],
        ['85.5', 855000n],
        ['-0.0000', 0n],
        ['-0', 0n],
        ['0.3000', 3000n],
        ['746251344.6807', 7462513446807n],
        ['96689212322.2351', 966892123222351n],
        // The previous double path falsely rejected this one.
        ['365963032346.3555', 3659630323463555n],
        // A double gives …9998n.
        ['899999999999.9997', 8999999999999997n],
        ['632097188007.2934', 6320971880072934n],
        // The decimal(19,4) maximum and minimum.
        ['999999999999999.9999', 9999999999999999999n],
        ['-999999999999999.9999', -9999999999999999999n],
        ['0.0001', 1n],
        ['-12.34', -123400n],
    ])('"%s" → %s', (text, expected) => {
        const money = fromText(text);

        expect(money.minor).toBe(expected);
        expect(money.currency).toBe('USD');
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    test.each([
        '1000000000000000.0000',
        '1.23456',
        '0.00005',
        '85.50001',
        '1e3',
        '-1E-7',
        '',
        '-',
        '.5',
        '5.',
        '+5',
        ' 5',
        '0x10',
        'NaN',
        'Infinity',
        '1,5',
    ])('"%s" → MoneyWireError + Sentry money.wire_reject', text => {
        expect(() => fromText(text)).toThrow(MoneyWireError);
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'money.wire_reject',
            expect.objectContaining({ level: 'error', tags: { 'money.reason': 'format' } }),
        );
    });

    test('a value that is not a WireAmount is a shape rejection', () => {
        const notWire = JSON.parse('{"amount":85.5}') as { amount: never };

        expect(() => moneyFromWire(notWire.amount, USD)).toThrow(MoneyWireError);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'money.wire_reject',
            expect.objectContaining({ tags: { 'money.reason': 'shape' } }),
        );
    });

    test('the amount itself never reaches Sentry', () => {
        expect(() => fromText('123456.78901')).toThrow(MoneyWireError);
        expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('123456');
    });
});

describe('moneyToWire', () => {
    test.each([
        '85.5000',
        '0.3000',
        '0.0000',
        '-0.0001',
        '746251344.6807',
        '365963032346.3555',
        '899999999999.9997',
        '632097188007.2934',
        '999999999999999.9999',
        '-999999999999999.9999',
    ])('"%s" round-trips to the same literal (no exponent, no double)', text => {
        expect(wireAmountText(moneyToWire(fromText(text)))).toBe(text);
    });

    test('pads to scale 4', () => {
        expect(wireAmountText(moneyToWire(fromUnits(855000n, USD)))).toBe('85.5000');
        expect(wireAmountText(moneyToWire(fromUnits(1n, USD)))).toBe('0.0001');
    });

    test.each([10n ** 19n, -(10n ** 19n), 10n ** 25n])('|minor| = %s ≥ 10¹⁹ throws', minor => {
        expect(() => moneyToWire(fromUnits(minor, USD))).toThrow(MoneyWireError);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'money.wire_reject',
            expect.objectContaining({ tags: { 'money.reason': 'range' } }),
        );
    });

    test('an ApproxMoney does not type-check', () => {
        const approx = convert(fromUnits(10000n, USD), '1', currencyCode('EUR'));

        // @ts-expect-error -- a converted (approximate) amount never becomes a request amount.
        expect(wireAmountText(moneyToWire(approx))).toBe('1.0000');
    });
});

describe('sweep: text → bigint is exact at every magnitude (spec 03 §8, C1-03)', () => {
    // mulberry32(20261028), 400,000 cases, orders 10^1…10^19 ledger units, both signs.
    const mulberry32 = (seed: number) => {
        let state = seed >>> 0;

        return () => {
            state = (state + 0x6d2b79f5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    test('400,000 cases: 0 wrong, 0 rejections, literal round-trips', () => {
        const random = mulberry32(20261028);
        const word = () => BigInt(Math.floor(random() * 4294967296));
        let wrong = 0;

        for (let index = 0; index < 400_000; index += 1) {
            const order = Math.floor(random() * 19);
            const bits = (word() << 96n) | (word() << 64n) | (word() << 32n) | word();
            const magnitude = bits % 10n ** BigInt(order + 1);
            const value = random() < 0.5 ? -magnitude : magnitude;
            const digits = magnitude.toString().padStart(5, '0');
            const text = `${value < 0n ? '-' : ''}${digits.slice(0, -4)}.${digits.slice(-4)}`;
            const money = fromText(text);

            if (money.minor !== value || wireAmountText(moneyToWire(money)) !== text) {
                wrong += 1;
            }
        }

        expect(wrong).toBe(0);
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
});

describe('regression anchor: why the double path is forbidden', () => {
    test('JSON.parse + Math.round(v * 1e4) loses ledger units above 2^39', () => {
        expect(Math.round(JSON.parse('899999999999.9997') * 1e4)).not.toBe(8999999999999997);
        expect(Number.isInteger(JSON.parse('365963032346.3555') * 1e4)).toBe(false);
    });
});

describe('mapItems', () => {
    interface Row {
        readonly id: string;
        readonly amount: string;
    }
    const toRow = (row: Row) => ({ id: row.id, amount: fromText(row.amount) });
    const rows: Row[] = [
        { id: 'a', amount: '1.0000' },
        { id: 'b', amount: '1e3' },
        { id: 'c', amount: '2.5' },
    ];

    test('a list of 3 with a bad second amount → [X, invalid, X], Sentry once', () => {
        expect(mapItems(rows, toRow, row => row.id)).toEqual([
            { id: 'a', amount: fromUnits(10000n, USD) },
            { kind: 'invalid', id: 'b' },
            { id: 'c', amount: fromUnits(25000n, USD) },
        ]);
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'money.wire_reject',
            expect.objectContaining({ extra: { itemId: 'b' } }),
        );
    });

    test('mapping the same list again does not report the same id again', () => {
        mapItems(rows, toRow, row => row.id);
        mapItems(rows, toRow, row => row.id);

        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });

    test('other errors propagate', () => {
        const failing = () => {
            throw new TypeError('bug');
        };

        expect(() => mapItems(rows, failing, row => row.id)).toThrow(TypeError);
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    test('an empty list maps to an empty list', () => {
        expect(mapItems([], toRow, (row: Row) => row.id)).toEqual([]);
    });

    test('a rejection outside mapItems is reported again after mapping', () => {
        mapItems(rows, toRow, row => row.id);
        expect(() => fromText('1e3')).toThrow(MoneyWireError);

        expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
    });
});
