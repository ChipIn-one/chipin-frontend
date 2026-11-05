import { describe, expect, test, vi } from 'vitest';

import type { WireAmount } from 'shared/money';
import {
    createWireAmount,
    currencyCode,
    fromUnits,
    isWireAmount,
    moneyFromWire,
    moneyToWire,
    MoneyWireError,
} from 'shared/money';

import { parseWireJson, stringifyWireJson } from './wireJson';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

const USD = currencyCode('USD');
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

// `parseWireJson` returns `unknown`; tests read it through this loose view.
const parse = (text: string): Record<string, unknown> =>
    parseWireJson(text) as Record<string, unknown>;
const units = (value: unknown): bigint => {
    if (!isWireAmount(value)) {
        throw new Error(`not a WireAmount: ${String(value)}`);
    }
    return moneyFromWire(value, USD).minor;
};

describe('parseWireJson: money literals parsed from text (spec 03 §8)', () => {
    test.each([
        ['85.5000', 855000n],
        ['85.5', 855000n],
        ['-0.0000', 0n],
        ['0.3000', 3000n],
        ['746251344.6807', 7462513446807n],
        ['96689212322.2351', 966892123222351n],
        ['365963032346.3555', 3659630323463555n],
        ['899999999999.9997', 8999999999999997n],
        ['632097188007.2934', 6320971880072934n],
        ['999999999999999.9999', 9999999999999999999n],
    ])('%s -> %s ledger units, and written back as the same literal', (literal, expected) => {
        const body = parse(`{"amount":${literal}}`);

        expect(units(body.amount)).toBe(expected);
        expect(stringifyWireJson({ amount: moneyToWire(fromUnits(expected, USD)) })).toBe(
            `{"amount":${unitsLiteral(expected)}}`,
        );
        // The transport itself writes the original literal back unchanged.
        expect(stringifyWireJson(body)).toBe(`{"amount":${literal}}`);
    });

    test.each(['1000000000000000.0000', '1.23456', '0.00005', '85.50001', '1e3', '-1E-7'])(
        '%s reaches the mapper as a WireAmount and is rejected there with MoneyWireError',
        literal => {
            const body = parse(`{"amount":${literal}}`);

            expect(isWireAmount(body.amount)).toBe(true);
            expect(() => units(body.amount)).toThrow(MoneyWireError);
        },
    );
});

describe('a money field round trip at 10^19 ledger units (the decimal(19,4) boundary)', () => {
    test.each([9999999999999999999n, -9999999999999999999n])(
        '%s units survive Money -> wire text -> Money exactly',
        value => {
            const text = stringifyWireJson({ amount: moneyToWire(fromUnits(value, USD)) });

            expect(text).toBe(`{"amount":${value < 0n ? '-' : ''}999999999999999.9999}`);
            expect(units(parse(String(text)).amount)).toBe(value);
        },
    );

    test('10^19 units do not fit the wire: moneyToWire rejects them', () => {
        expect(() => moneyToWire(fromUnits(10n ** 19n, USD))).toThrow(MoneyWireError);
    });
});

describe('parseWireJson: the name-only registry decided by shape', () => {
    test('SharingMode.shares is a decimal map: its values are WireDecimal strings', () => {
        const body = parse(
            '{"sharingMode":{"type":"SHARES","shares":{"u1":2,"u2":1.5},"percentageShares":{"u1":33.3333}}}',
        );

        expect(body.sharingMode).toEqual({
            type: 'SHARES',
            shares: { u1: '2', u2: '1.5' },
            percentageShares: { u1: '33.3333' },
        });
    });

    test('ExpenseActivityMetadata.shares is an array: its shareAmount stays money', () => {
        const body = parse(
            '{"metadata":{"amount":10,"shares":[{"userId":"u1","shareAmount":3.3334,"weight":1},{"userId":"u2","shareAmount":6.6666,"weight":2}]}}',
        );
        const { metadata } = body as { metadata: { amount: unknown; shares: unknown[] } };
        const [first, second] = metadata.shares as Record<string, unknown>[];

        expect(units(metadata.amount)).toBe(100000n);
        expect(units(first?.shareAmount)).toBe(33334n);
        expect(units(second?.shareAmount)).toBe(66666n);
        expect(first?.weight).toBe(1);
        expect(first?.userId).toBe('u1');
    });

    test('a number array under a map key is not a map: plain numbers', () => {
        expect(parse('{"shares":[1,2.5],"customShares":[3]}')).toEqual({
            shares: [1, 2.5],
            customShares: [3],
        });
    });

    test('customShares values are WireAmount; nullable money stays null', () => {
        const body = parse(
            '{"amount":null,"netBalance":null,"sharingMode":{"customShares":{"u1":42.75,"u2":null}}}',
        );
        const { customShares } = body.sharingMode as { customShares: Record<string, unknown> };

        expect(body.amount).toBeNull();
        expect(body.netBalance).toBeNull();
        expect(units(customShares.u1)).toBe(427500n);
        expect(customShares.u2).toBeNull();
    });

    test('an error body carrying `amount` gets a WireAmount; other numbers stay numbers', () => {
        const body = parse(
            '{"code":"LEDGER.VERSION_CONFLICT","details":{"amount":5,"limit":10},"current":{"amount":85.5,"version":3}}',
        );
        const details = body.details as Record<string, unknown>;
        const current = body.current as Record<string, unknown>;

        expect(units(details.amount)).toBe(50000n);
        expect(details.limit).toBe(10);
        expect(units(current.amount)).toBe(855000n);
        expect(current.version).toBe(3);
    });

    test('a registry money field holding a non-number passes through unchanged, never throws', () => {
        const body = parse(
            '{"details":{"amount":"must be positive"},"netAmount":{"value":1},"shareAmount":true}',
        );

        expect(body.details).toEqual({ amount: 'must be positive' });
        expect(body.netAmount).toEqual({ value: 1 });
        expect(body.shareAmount).toBe(true);
        // The mapper is where it fails, in a defined way.
        expect(() => moneyFromWire(body.netAmount as WireAmount, USD)).toThrow(MoneyWireError);
    });

    test('non-money numbers, rates and a bare number body', () => {
        expect(parse('{"rate":1,"count":12,"rates":{"EUR":0.9123}}')).toEqual({
            rate: 1,
            count: 12,
            rates: { EUR: '0.9123' },
        });
        expect(parseWireJson('42')).toBe(42);
        expect(parseWireJson('[1,{"amount":2}]')).toEqual([1, { amount: createWireAmount('2') }]);
    });

    test('a key inside a string value is not touched', () => {
        expect(parse('{"description":"Dinner \\"amount\\":5"}').description).toBe(
            'Dinner "amount":5',
        );
    });
});

describe('parseWireJson as an Axios transformResponse', () => {
    test('parses only an application/json text body', () => {
        expect(parseWireJson('{"amount":1}', JSON_HEADERS)).toEqual({
            amount: createWireAmount('1'),
        });
        expect(parseWireJson('{"amount":1}', { get: () => 'application/json' })).toEqual({
            amount: createWireAmount('1'),
        });
    });

    test.each([
        ['an empty 204 body', '', JSON_HEADERS],
        ['an HTML 502 page', '<html>Bad gateway</html>', { 'Content-Type': 'text/html' }],
        ['JSON text without a JSON content type', '{"amount":1}', { 'content-type': 'text/plain' }],
        ['malformed JSON', '{"amount":', JSON_HEADERS],
        ['a duplicate key', '{"a":1,"a":2}', JSON_HEADERS],
    ])('passes %s through as is', (_name, data, headers) => {
        expect(parseWireJson(data, headers)).toBe(data);
    });

    test('passes non-string data through as is', () => {
        const blob = new Blob(['x']);

        expect(parseWireJson(undefined, JSON_HEADERS)).toBeUndefined();
        expect(parseWireJson(blob, JSON_HEADERS)).toBe(blob);
    });
});

describe('stringifyWireJson', () => {
    test('writes WireAmount as a plain literal and decimal maps as numbers', () => {
        expect(
            stringifyWireJson({
                amount: createWireAmount('899999999999.9997'),
                sharingMode: {
                    customShares: { u1: createWireAmount('0.0001') },
                    percentageShares: { u1: '33.3333', u2: 'oops' },
                },
                note: '12.5',
                rate: 1,
            }),
        ).toBe(
            '{"amount":899999999999.9997,"sharingMode":{"customShares":{"u1":0.0001},"percentageShares":{"u1":33.3333,"u2":"oops"}},"note":"12.5","rate":1}',
        );
    });

    test('a malformed hand-built WireAmount never reaches the backend', () => {
        expect(() => stringifyWireJson({ amount: createWireAmount('1e3') })).toThrow(
            MoneyWireError,
        );
    });

    test('sets the JSON content type and passes undefined and strings through', () => {
        const setContentType = vi.fn();

        expect(stringifyWireJson({ a: 1 }, { setContentType })).toBe('{"a":1}');
        expect(setContentType).toHaveBeenCalledWith('application/json');
        expect(stringifyWireJson(undefined)).toBeUndefined();
        expect(stringifyWireJson('{"amount":1}')).toBe('{"amount":1}');
    });
});

function unitsLiteral(value: bigint): string {
    const negative = value < 0n;
    const digits = (negative ? -value : value).toString().padStart(5, '0');

    return `${negative ? '-' : ''}${digits.slice(0, -4)}.${digits.slice(-4)}`;
}
