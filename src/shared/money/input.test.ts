import { describe, expect, test } from 'vitest';

import { moneyInputText, moneyLedgerText, parseMoneyInput } from './input';
import { currencyCode, fromUnits } from './money';

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
        // Leading zeros do not count toward the 15 integer digits.
        ['000000000000000001', 'USD', 10000n],
        ['0000123456789012345.67', 'USD', 1234567890123456700n],
        ['000', 'USD', 0n],
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
        ['0001234567890123456', 'USD'],
    ])('%j %s → null', (raw, code) => {
        expect(parseMoneyInput(raw, currencyCode(code))).toBeNull();
    });

    test('a trailing separator without digits is accepted', () => {
        expect(parseMoneyInput('10.', currencyCode('USD'))?.minor).toBe(100000n);
        expect(parseMoneyInput('10.', currencyCode('JPY'))?.minor).toBe(100000n);
    });
});

describe('moneyInputText', () => {
    test.each([
        [855_000n, '85.5'],
        [1_000_000n, '100'],
        [34n, '0.0034'],
        [101_234n, '10.1234'],
        [0n, '0'],
        [1_000n, '0.1'],
    ])('%s ledger units → %j (no trailing fraction zeros)', (units, text) => {
        const money = fromUnits(units, currencyCode('KWD'));

        expect(moneyInputText(money)).toBe(text);
    });
});

describe('moneyLedgerText', () => {
    test.each([
        [33_350n, '3.3350'],
        [40n, '0.0040'],
        [1_000_000n, '100.0000'],
        [0n, '0.0000'],
    ])('%s ledger units → %j (all four ledger digits)', (units, text) => {
        expect(moneyLedgerText(fromUnits(units, currencyCode('USD')))).toBe(text);
    });
});
