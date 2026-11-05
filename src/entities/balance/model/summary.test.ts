import { expect, test } from 'vitest';

import type { CurrencyCode, Money } from 'shared/money';
import { currencyCode, isApprox } from 'shared/money';

import { summarizeBalances } from './summary';

const money = (minor: bigint, currency = 'USD'): Money => ({
    minor,
    currency: currencyCode(currency),
});

// 1 EUR = 1.1 USD, 1 JPY = 0.0067 USD; no KWD rate.
const RATES: Record<string, string> = { 'EUR>USD': '1.1', 'JPY>USD': '0.0067', 'USD>EUR': '0.9' };
const rateOf = (from: CurrencyCode, to: CurrencyCode) => RATES[`${from}>${to}`] ?? null;
const USD = currencyCode('USD');

const minors = (list: readonly Money[]) => {
    const { net, owed, owing, converted, unconverted } = summarizeBalances(list, USD, rateOf);

    return { net: net.minor, owed: owed.minor, owing: owing.minor, converted, unconverted };
};

test.each([
    ['empty', [], { net: 0n, owed: 0n, owing: 0n, converted: false, unconverted: [] }],
    [
        'same currency, no conversion',
        [money(100_000n), money(-25_000n)],
        { net: 75_000n, owed: 100_000n, owing: 25_000n, converted: false, unconverted: [] },
    ],
    [
        'zero balances are skipped, also without a rate',
        [money(0n, 'KWD'), money(0n)],
        { net: 0n, owed: 0n, owing: 0n, converted: false, unconverted: [] },
    ],
    [
        'converts other currencies half-up at scale 4',
        // 10 EUR → 11 USD; −3 JPY → −0.0201 USD; 0.0005 JPY → 0.00000335 → 0 USD.
        [money(100_000n, 'EUR'), money(-30_000n, 'JPY'), money(5n, 'JPY')],
        { net: 109_799n, owed: 110_000n, owing: 201n, converted: true, unconverted: [] },
    ],
    [
        'a balance without a rate is listed, not summed',
        [money(10_000n), money(-50_000n, 'KWD')],
        { net: 10_000n, owed: 10_000n, owing: 0n, converted: false, unconverted: ['KWD'] },
    ],
    [
        'sub-minor debts count',
        [money(40n), money(-1n)],
        { net: 39n, owed: 40n, owing: 1n, converted: false, unconverted: [] },
    ],
] as const)('%s', (_name, balances, expected) => {
    expect(minors(balances)).toEqual(expected);
});

test('totals are approximate in the target currency', () => {
    const summary = summarizeBalances([money(10_000n, 'EUR')], USD, rateOf);

    expect([summary.net, summary.owed, summary.owing].every(isApprox)).toBe(true);
    expect(summary.net.currency).toBe('USD');
});
