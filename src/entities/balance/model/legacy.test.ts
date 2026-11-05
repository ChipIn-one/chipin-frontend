import { describe, expect, test } from 'vitest';

import type { ExpenseActivityMetadata } from 'api/activity.types';
import { normalizeApiMoneyAmount } from 'helpers/numbers';
import { currencyCode } from 'shared/money';

import {
    legacyAmountFromMoney,
    legacyBalanceFromEntry,
    legacyBalanceFromFriend,
    legacyExpenseBalanceChange,
    legacyPartitionEntries,
    legacyRateLookup,
    legacySummarizeEntries,
} from './legacy';

const minorOf = (netBalance: number, currency = 'USD') =>
    legacyBalanceFromEntry({ currency, netBalance }).net.minor;

describe('number → Money bridge', () => {
    test.each([
        [0, 0n],
        [-0, 0n],
        [85.5, 855_000n],
        [-3.25, -32_500n],
        [0.0001, 1n],
        [-0.0004, -4n],
        [0.1 + 0.2, 3_000n],
        [2.675, 26_750n],
        [1e-7, 0n],
        [-0.00004, 0n],
        [0.00005, 1n],
        [-0.00005, -1n],
        [99_999_999_999.9999, 999_999_999_999_999n],
        [123_456, 1_234_560_000n],
        [1.5e21, 15_000_000_000_000_000_000_000_000n],
    ])('%s → %s ledger units', (value, expected) => {
        expect(minorOf(value)).toBe(expected);
    });

    test('is exact for every scale-4 literal below 1e11 (seeded sweep)', () => {
        let seed = 42;
        const next = () => {
            seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
            return seed;
        };

        for (let index = 0; index < 20_000; index += 1) {
            const integer = BigInt(next()) * BigInt(next() % 47); // up to ~1e11
            const units = (integer % 100_000_000_000n) * 10_000n + BigInt(next() % 10_000);
            const signed = index % 2 === 0 ? units : -units;
            const literal = `${signed < 0n ? '-' : ''}${(units / 10_000n).toString()}.${(units % 10_000n).toString().padStart(4, '0')}`;

            expect(minorOf(JSON.parse(literal) as number)).toBe(signed);
        }
    });

    test('agrees with normalizeApiMoneyAmount', () => {
        for (const value of [0.1 + 0.2, 6.666700000000001, -0.30000000000000004, 2.67549, 1e-5]) {
            expect(
                legacyAmountFromMoney(
                    legacyBalanceFromEntry({ currency: 'USD', netBalance: value }).net,
                ),
            ).toBe(normalizeApiMoneyAmount(value));
        }
    });

    test('rejects non-finite numbers and invalid currencies', () => {
        expect(() => minorOf(Number.NaN)).toThrow(RangeError);
        expect(() => minorOf(Number.POSITIVE_INFINITY)).toThrow(RangeError);
        expect(() => minorOf(1, 'usd1')).toThrow(RangeError);
    });

    test('friend balances map the same way', () => {
        expect(legacyBalanceFromFriend({ currency: 'jpy', netAmount: -0.4 }).net).toEqual({
            minor: -4_000n,
            currency: 'JPY',
        });
    });
});

test('Money → number round-trips', () => {
    for (const minor of [0n, 1n, -1n, 855_000n, -999_999_999_999_999n]) {
        const money = { minor, currency: currencyCode('USD') };

        expect(minorOf(legacyAmountFromMoney(money))).toBe(minor);
    }
});

test('legacyPartitionEntries: zero is settled, sub-minor is a debt', () => {
    const { owed, owe, settled } = legacyPartitionEntries([
        { currency: 'USD', netBalance: 0.004 },
        { currency: 'EUR', netBalance: -0.0001 },
        { currency: 'GBP', netBalance: 0 },
        { currency: 'JPY', netBalance: 0.1 + 0.2 - 0.3 },
    ]);

    expect(owed.map(entry => entry.currency)).toEqual(['USD']);
    expect(owe.map(entry => entry.currency)).toEqual(['EUR']);
    expect(settled.map(entry => entry.currency)).toEqual(['GBP', 'JPY']);
});

test('legacyExpenseBalanceChange', () => {
    const metadata = (payerId: string): ExpenseActivityMetadata => ({
        type: 'expense',
        entryId: 'entry',
        amount: 10,
        currency: 'USD',
        payerId,
        payerDisplayName: 'Payer',
        shares: [{ userId: 'me', displayName: 'Me', shareAmount: 3.3333, currency: 'USD' }],
    });

    expect(legacyExpenseBalanceChange(metadata('me'), 'me')?.minor).toBe(66_667n);
    expect(legacyExpenseBalanceChange(metadata('other'), 'me')?.minor).toBe(-33_333n);
    expect(legacyExpenseBalanceChange(metadata('other'), 'stranger')?.minor).toBe(0n);
    expect(
        legacyExpenseBalanceChange({ ...metadata('me'), shares: undefined }, 'me'),
    ).toBeUndefined();
});

describe('legacyRateLookup', () => {
    const rateOf = legacyRateLookup({ EUR: 0.9, JPY: 150, BAD: 0 }, 'USD');
    const code = currencyCode;

    test.each([
        ['USD', 'EUR', '0.9'],
        ['EUR', 'USD', String(1 / 0.9)],
        ['EUR', 'JPY', String(150 / 0.9)],
        ['USD', 'SEK', null],
        ['BAD', 'USD', null],
    ] as const)('%s → %s', (from, to, expected) => {
        expect(rateOf(code(from), code(to))).toBe(expected);
    });
});

test('legacySummarizeEntries keeps the legacy totals shape', () => {
    expect(
        legacySummarizeEntries(
            [
                { currency: 'USD', netBalance: 10.5 },
                { currency: 'EUR', netBalance: -3.25 },
                { currency: 'SEK', netBalance: 7 },
                { currency: 'GBP', netBalance: 0 },
            ],
            { EUR: 0.9 },
            'USD',
            'USD',
        ),
    ).toEqual({ netTotalInBase: 6.8889, owedTotalInBase: 10.5, owingTotalInBase: 3.6111 });
});
