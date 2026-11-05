import { describe, expect, test } from 'vitest';

import { parseMoneyInput } from './input';
import { currencyCode } from './money';

describe('parseMoneyInput', () => {
    test.each([
        ['1 234,5', 'USD', 12345000n],
        ['1 234,5', 'USD', 12345000n],
        ['1 234.56', 'USD', 12345600n],
        ['  42  ', 'USD', 420000n],
        ['0,', 'USD', 0n],
        ['0', 'USD', 0n],
        ['.5', 'USD', 5000n],
        ['1.23', 'USD', 12300n],
        ['1.234', 'KWD', 12340n],
        ['1.2', 'KWD', 12000n],
        ['10', 'JPY', 100000n],
        ['999999999999999.99', 'USD', 9999999999999999900n],
        ['007', 'USD', 70000n],
    ])('%j %s → %s', (raw, code, expected) => {
        expect(parseMoneyInput(raw, currencyCode(code))).toEqual({
            minor: expected,
            currency: code,
        });
    });

    test.each([
        ['', 'USD'],
        ['   ', 'USD'],
        ['.', 'USD'],
        [',', 'USD'],
        ['1.234', 'USD'],
        ['1.2345', 'KWD'],
        ['10,5', 'JPY'],
        ['-1', 'USD'],
        ['+1', 'USD'],
        ['1.2.3', 'USD'],
        ['1,2.3', 'USD'],
        ['1e3', 'USD'],
        ['abc', 'USD'],
        ['1 234,5 €', 'EUR'],
        // 16 integer digits: beyond the decimal(19,4) boundary.
        ['1234567890123456', 'USD'],
    ])('%j %s → null', (raw, code) => {
        expect(parseMoneyInput(raw, currencyCode(code))).toBeNull();
    });

    test('a trailing separator without digits is accepted', () => {
        expect(parseMoneyInput('10.', currencyCode('USD'))?.minor).toBe(100000n);
        expect(parseMoneyInput('10.', currencyCode('JPY'))?.minor).toBe(100000n);
    });
});
