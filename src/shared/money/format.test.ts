import { describe, expect, test } from 'vitest';

import { formatMoney, formatMoneyParts } from './format';
import { currencyCode, fromUnits } from './money';

// Locales use NBSP / narrow NBSP as separators; compare with plain spaces.
const plain = (text: string) => text.replace(/\s/g, ' ');
const money = (minor: bigint, code: string) => fromUnits(minor, currencyCode(code));

describe('formatMoney', () => {
    test.each([
        ['en', -12345000n, 'USD', '-$1,234.50'],
        ['en', 12350000n, 'JPY', '¥1,235'],
        ['en', 12345670n, 'KWD', 'KWD 1,234.567'],
        ['ru', -12345000n, 'USD', '-1 234,50 $'],
        ['ru', 12350000n, 'JPY', '1 235 ¥'],
        ['ru', 12345670n, 'KWD', '1 234,567 KWD'],
        ['pt-BR', -12345000n, 'USD', '-US$ 1.234,50'],
        ['pt-BR', 12350000n, 'JPY', 'JP¥ 1.235'],
        ['pt-BR', 12345670n, 'KWD', 'KWD 1.234,567'],
    ])('%s %s %s → %s', (locale, minor, code, expected) => {
        expect(plain(formatMoney(money(minor, code), { locale }))).toBe(expected);
    });

    test('rounds half-up away from zero to the minor units first', () => {
        expect(formatMoney(money(10050n, 'USD'), { locale: 'en' })).toBe('$1.01');
        expect(formatMoney(money(-10050n, 'USD'), { locale: 'en' })).toBe('-$1.01');
        expect(formatMoney(money(5000n, 'JPY'), { locale: 'en' })).toBe('¥1');
    });

    test('an amount below one minor unit is "< one minor unit", with the sign of the amount', () => {
        expect(formatMoney(money(40n, 'USD'), { locale: 'en' })).toBe('< $0.01');
        expect(formatMoney(money(-49n, 'USD'), { locale: 'en' })).toBe('< -$0.01');
        expect(formatMoney(money(4999n, 'JPY'), { locale: 'en' })).toBe('< ¥1');
        expect(plain(formatMoney(money(4n, 'KWD'), { locale: 'en' }))).toBe('< KWD 0.001');
    });

    test('zero is zero, not "< …"', () => {
        expect(formatMoney(money(0n, 'USD'), { locale: 'en' })).toBe('$0.00');
    });

    test.each([
        [{ signDisplay: 'always' }, 100n, '+$0.01'],
        [{ signDisplay: 'always' }, -100n, '-$0.01'],
        [{ signDisplay: 'exceptZero' }, 0n, '$0.00'],
        [{ signDisplay: 'exceptZero' }, 100n, '+$0.01'],
        [{ currencyDisplay: 'code' }, 12345000n, 'USD 1,234.50'],
        [{ compact: true }, 12345678900n, '$1.2M'],
    ] as const)('%j %s → %s', (options, minor, expected) => {
        expect(plain(formatMoney(money(minor, 'USD'), { locale: 'en', ...options }))).toBe(
            expected,
        );
    });

    test('formats from a decimal string: no precision loss at the decimal(19,4) maximum', () => {
        expect(formatMoney(money(9999999999999999900n, 'USD'), { locale: 'en' })).toBe(
            '$999,999,999,999,999.99',
        );
    });

    test('a formatter is reused for the same locale, currency and options', () => {
        const first = formatMoney(money(10000n, 'EUR'), { locale: 'en' });

        expect(formatMoney(money(10000n, 'EUR'), { locale: 'en' })).toBe(first);
        expect(formatMoney(money(10000n, 'EUR'), { locale: 'ru' })).not.toBe(first);
    });
});

describe('formatMoneyParts', () => {
    test('returns Intl parts of the rounded amount', () => {
        expect(formatMoneyParts(money(-12345000n, 'USD'), { locale: 'en' })).toEqual([
            { type: 'minusSign', value: '-' },
            { type: 'currency', value: '$' },
            { type: 'integer', value: '1' },
            { type: 'group', value: ',' },
            { type: 'integer', value: '234' },
            { type: 'decimal', value: '.' },
            { type: 'fraction', value: '50' },
        ]);
    });

    test('prefixes "< " as a literal part below one minor unit', () => {
        const parts = formatMoneyParts(money(40n, 'USD'), { locale: 'en' });

        expect(parts[0]).toEqual({ type: 'literal', value: '< ' });
        expect(parts.map(part => part.value).join('')).toBe('< $0.01');
    });
});
