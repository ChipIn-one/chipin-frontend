import * as Sentry from '@sentry/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import { normalizeApiMoneyAmount } from 'helpers/numbers';
import { currencyCode } from 'shared/money';

import {
    legacyActivityEvent,
    legacyActivityPreview,
    legacyAmountFromMoney,
    legacyBalanceFromEntry,
    legacyCurrencyOrDefault,
    legacyPartitionEntries,
    legacyRateLookup,
    legacyRatesFromDecimals,
    legacySummarizeEntries,
    resetLegacyRejectReports,
} from './legacy';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

beforeEach(() => {
    resetLegacyRejectReports();
});

const usd = (minor: bigint) => ({ minor, currency: currencyCode('USD') });
const entry = (netBalance: number, currency = 'USD'): BalanceEntry => ({ currency, netBalance });
// Bad runtime input that the legacy types do not admit (JSON can carry anything).
const unsafeEntry = (netBalance: unknown, currency: unknown): BalanceEntry =>
    // The cast is the point: a JSON.parse DTO is not checked at runtime.
    ({ currency, netBalance }) as unknown as BalanceEntry;

const minorOf = (netBalance: number, currency = 'USD') =>
    legacyBalanceFromEntry({ currency, netBalance })?.net.minor;

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
                    legacyBalanceFromEntry({ currency: 'USD', netBalance: value })?.net ?? usd(0n),
                ),
            ).toBe(normalizeApiMoneyAmount(value));
        }
    });

    test.each([
        ['empty currency', 1, '', 'currency'],
        ['two-letter currency', 1, 'US', 'currency'],
        ['four-letter currency', 1, 'EURO', 'currency'],
        ['null currency', 1, null, 'currency'],
        ['NaN amount', Number.NaN, 'USD', 'amount'],
        ['Infinity amount', Number.POSITIVE_INFINITY, 'USD', 'amount'],
        ['null amount', null, 'USD', 'amount'],
    ] as const)(
        '%s → skipped, reported once without the amount',
        (_name, amount, currency, reason) => {
            const entry = unsafeEntry(amount, currency);

            expect(legacyBalanceFromEntry(entry)).toBeNull();
            expect(legacyBalanceFromEntry(entry)).toBeNull();
            expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
            expect(Sentry.captureMessage).toHaveBeenCalledWith('money.legacy_reject', {
                level: 'error',
                tags: { 'money.reason': reason },
            });
        },
    );
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

const legacyExpense = (amount: number, shareAmount: number, currency = 'USD'): AppEvent => ({
    id: 'e1',
    seq: 4,
    domain: 'LEDGER',
    action: 'EXPENSE_UPDATED',
    actorUserId: 'me',
    actorSnapshot: { displayName: 'Me' },
    subjectType: 'expense',
    subjectId: 'entry',
    createdAt: 1_700_000_000,
    parentActivityId: 'p1',
    metadata: {
        type: 'expense',
        entryId: 'entry',
        amount,
        currency,
        payerId: 'me',
        payerDisplayName: 'Me',
        shares: [{ userId: 'me', displayName: 'Me', shareAmount, currency }],
    },
});

test('legacyActivityEvent carries legacy amounts into Money, the rest as is', () => {
    const event = legacyActivityEvent(legacyExpense(10, 3.3333));

    expect(event).toMatchObject({
        id: 'e1',
        seq: 4,
        action: 'EXPENSE_UPDATED',
        parentActivityId: 'p1',
    });
    expect(event.metadata?.type === 'expense' && event.metadata.amount).toEqual(usd(100_000n));
    expect(event.metadata?.type === 'expense' && event.metadata.shares?.[0]?.shareAmount).toEqual(
        usd(33_333n),
    );
});

test('legacyActivityEvent shows an event with an unreadable amount as an unknown event', () => {
    const event = legacyActivityEvent(legacyExpense(Number.NaN, 1));

    expect(event).toMatchObject({ id: 'e1', action: 'EXPENSE_UPDATED', metadata: null });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('money.legacy_reject', expect.anything());
});

test('legacyActivityPreview maps both events of a preview', () => {
    const item = { parent: legacyExpense(5, 5), lastEvent: legacyExpense(10, 3.3333) };
    const preview = legacyActivityPreview(item);

    expect(preview.parent.metadata?.type === 'expense' && preview.parent.metadata.amount).toEqual(
        usd(50_000n),
    );
    expect(preview.lastEvent.seq).toBe(4);
});

test('legacyRatesFromDecimals reads decimal-text rates as numbers and drops unusable ones', () => {
    expect(
        legacyRatesFromDecimals({ EUR: '0.92', VND: '25900', ZERO: '0', BAD: 'x', EMPTY: '' }),
    ).toEqual({ EUR: 0.92, VND: 25_900 });
});

describe('legacyRateLookup', () => {
    const rateOf = legacyRateLookup({ EUR: 0.9, JPY: 150, BAD: 0, NAN: Number.NaN }, 'USD');
    const code = currencyCode;

    test.each([
        ['USD', 'EUR', { from: '1', to: '0.9' }],
        ['EUR', 'USD', { from: '0.9', to: '1' }],
        ['EUR', 'JPY', { from: '0.9', to: '150' }],
        ['USD', 'SEK', null],
        ['BAD', 'USD', null],
        ['NAN', 'USD', null],
    ] as const)('%s → %s', (from, to, expected) => {
        expect(rateOf(code(from), code(to))).toEqual(expected);
    });
});

describe('legacySummarizeEntries (rate direction end to end)', () => {
    const rates = { EUR: 0.9, JPY: 150 };

    test('EUR → USD divides by the EUR rate', () => {
        // −9 EUR / 0.9 = −10 USD.
        expect(legacySummarizeEntries([entry(-9, 'EUR')], rates, 'USD', 'USD')).toEqual({
            netTotalInBase: -10,
            owedTotalInBase: 0,
            owingTotalInBase: 10,
        });
    });

    test('USD → JPY multiplies by the JPY rate', () => {
        expect(legacySummarizeEntries([entry(2, 'USD')], rates, 'USD', 'JPY')).toEqual({
            netTotalInBase: 300,
            owedTotalInBase: 300,
            owingTotalInBase: 0,
        });
    });

    test('keeps the legacy totals shape; no rate → left out, zero → skipped', () => {
        expect(
            legacySummarizeEntries(
                [entry(10.5, 'USD'), entry(-3.25, 'EUR'), entry(7, 'SEK'), entry(0, 'GBP')],
                rates,
                'USD',
                'USD',
            ),
        ).toEqual({ netTotalInBase: 6.8889, owedTotalInBase: 10.5, owingTotalInBase: 3.6111 });
    });

    test('a balance in the target currency counts without any rate', () => {
        expect(legacySummarizeEntries([entry(4, 'USD')], {}, 'EUR', 'USD')).toEqual({
            netTotalInBase: 4,
            owedTotalInBase: 4,
            owingTotalInBase: 0,
        });
    });

    test('invalid entries and an invalid target do not throw', () => {
        expect(
            legacySummarizeEntries(
                [entry(5, 'USD'), unsafeEntry(1, null), unsafeEntry(Number.NaN, 'EUR')],
                rates,
                'USD',
                'EURO',
            ),
        ).toEqual({ netTotalInBase: 5, owedTotalInBase: 5, owingTotalInBase: 0 });
    });
});

test('legacyCurrencyOrDefault falls back to the default currency', () => {
    expect(legacyCurrencyOrDefault('eur')).toBe('EUR');
    expect(legacyCurrencyOrDefault('')).toBe('USD');
    expect(legacyCurrencyOrDefault(null)).toBe('USD');
    expect(legacyCurrencyOrDefault('EURO')).toBe('USD');
});
