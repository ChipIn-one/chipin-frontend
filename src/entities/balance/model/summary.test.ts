import { expect, test } from 'vitest';

import type { CurrencyCode, Money } from 'shared/money';
import { currencyCode, isApprox } from 'shared/money';

import type { Rate } from './summary';
import { summarizeBalances } from './summary';

const money = (minor: bigint, currency = 'USD'): Money => ({
    minor,
    currency: currencyCode(currency),
});

// Units of each currency per 1 USD (the legacy dashboard model); no KWD-less gaps except SEK.
const PER_USD: Record<string, string> = {
    USD: '1',
    EUR: '0.9',
    JPY: '150',
    KWD: '0.31',
    VND: '25900',
    ZZZ: '0',
};
const rateOf = (from: CurrencyCode, to: CurrencyCode): Rate | null => {
    const [fromRate, toRate] = [PER_USD[from], PER_USD[to]];

    return fromRate && toRate ? { from: fromRate, to: toRate } : null;
};

const minors = (list: readonly Money[], target = 'USD') => {
    const { net, owed, owing, converted, unconverted } = summarizeBalances(
        list,
        currencyCode(target),
        rateOf,
    );

    return { net: net.minor, owed: owed.minor, owing: owing.minor, converted, unconverted };
};

const jpyUnits = (count: number) => Array.from({ length: count }, () => money(1n, 'JPY'));

test.each([
    ['empty', [], 'USD', { net: 0n, owed: 0n, owing: 0n, converted: false, unconverted: [] }],
    [
        'same currency, no conversion',
        [money(100_000n), money(-25_000n)],
        'USD',
        { net: 75_000n, owed: 100_000n, owing: 25_000n, converted: false, unconverted: [] },
    ],
    [
        'same currency counts without any rate',
        [money(10_000n, 'SEK')],
        'SEK',
        { net: 10_000n, owed: 10_000n, owing: 0n, converted: false, unconverted: [] },
    ],
    [
        'zero balances are skipped, also without a rate',
        [money(0n, 'SEK'), money(0n)],
        'USD',
        { net: 0n, owed: 0n, owing: 0n, converted: false, unconverted: [] },
    ],
    [
        'exact cross rate: 10 USD and −9 EUR cancel out (NEUTRAL)',
        [money(100_000n), money(-90_000n, 'EUR')],
        'USD',
        { net: 0n, owed: 100_000n, owing: 100_000n, converted: true, unconverted: [] },
    ],
    [
        'rounds once: 75 × 0.0001 JPY = 0.0000500 USD → 0.0001 (per-item rounding gives 0)',
        jpyUnits(75),
        'USD',
        { net: 1n, owed: 1n, owing: 0n, converted: true, unconverted: [] },
    ],
    [
        'DSH-001: 0.3333 VND owed in USD stays a tiny positive, not 0',
        [money(3_333n, 'VND')],
        'USD',
        { net: 1n, owed: 1n, owing: 0n, converted: true, unconverted: [] },
    ],
    [
        'DSH-001: −0.0001 USD in KWD stays a tiny negative',
        [money(-1n)],
        'KWD',
        { net: -1n, owed: 0n, owing: 1n, converted: true, unconverted: [] },
    ],
    [
        'net of tiny parts keeps the sign of the exact sum',
        [money(1n), money(-1n, 'EUR')],
        'USD',
        // 0.0001 − 0.000111… = −0.0000111… → −1 unit.
        { net: -1n, owed: 1n, owing: 1n, converted: true, unconverted: [] },
    ],
    [
        'a balance without a rate, or with a zero rate, is listed, not summed',
        [money(10_000n), money(-50_000n, 'SEK'), money(1n, 'ZZZ')],
        'USD',
        { net: 10_000n, owed: 10_000n, owing: 0n, converted: false, unconverted: ['SEK', 'ZZZ'] },
    ],
] as const)('%s', (_name, balances, target, expected) => {
    expect(minors(balances, target)).toEqual(expected);
});

test('totals are approximate in the target currency', () => {
    const summary = summarizeBalances([money(10_000n, 'EUR')], currencyCode('USD'), rateOf);

    expect([summary.net, summary.owed, summary.owing].every(isApprox)).toBe(true);
    expect(summary.net.currency).toBe('USD');
    expect(summary.owed.minor).toBe(11_111n);
});

// The per-entry exact reference: convert every balance, sum the exact fractions, round once
// (the previous implementation). Per-currency summing must give the same totals.
const referenceSummary = (list: readonly Money[], target: CurrencyCode) => {
    let owed = { n: 0n, d: 1n };
    let owing = { n: 0n, d: 1n };
    const add = (a: { n: bigint; d: bigint }, b: { n: bigint; d: bigint }) => ({
        n: a.n * b.d + b.n * a.d,
        d: a.d * b.d,
    });
    const round = ({ n, d }: { n: bigint; d: bigint }) => {
        const magnitude = n < 0n ? -n : n;
        let units = magnitude / d + ((magnitude % d) * 2n >= d ? 1n : 0n);

        if (units === 0n && magnitude !== 0n) {
            units = 1n;
        }
        return n < 0n ? -units : units;
    };

    for (const balance of list) {
        const rate =
            balance.currency === target ? { from: '1', to: '1' } : rateOf(balance.currency, target);

        if (balance.minor === 0n || !rate) {
            continue;
        }
        // Test rates are plain decimals with ≤ 6 fraction digits: scale both sides by 10⁶.
        const toUnits = (text: string) => {
            const [integer = '0', fraction = ''] = text.split('.');

            return BigInt(integer + fraction.padEnd(6, '0'));
        };
        const value = { n: balance.minor * toUnits(rate.to), d: toUnits(rate.from) };

        if (value.n > 0n) {
            owed = add(owed, value);
        } else {
            owing = add(owing, { n: -value.n, d: value.d });
        }
    }
    return {
        net: round(add(owed, { n: -owing.n, d: owing.d })),
        owed: round(owed),
        owing: round(owing),
    };
};

test('per-currency summing equals converting every entry (many entries per currency)', () => {
    let seed = 7;
    const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
        return seed;
    };
    const currencies = ['USD', 'EUR', 'JPY', 'KWD', 'VND'];

    for (const target of ['USD', 'EUR', 'KWD']) {
        const list = Array.from({ length: 3_000 }, () =>
            money(BigInt((next() % 2_000_001) - 1_000_000), currencies[next() % currencies.length]),
        );
        const { net, owed, owing } = summarizeBalances(list, currencyCode(target), rateOf);

        expect({ net: net.minor, owed: owed.minor, owing: owing.minor }).toEqual(
            referenceSummary(list, currencyCode(target)),
        );
    }
});

test('a currency without a rate is listed once', () => {
    expect(minors([money(1n, 'SEK'), money(-2n, 'SEK'), money(3n)]).unconverted).toEqual(['SEK']);
});

test('performance: 60 currencies × 2000 entries stays fast', () => {
    const codes = Array.from(
        { length: 60 },
        (_, index) =>
            `Q${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
    );
    const rates = new Map(codes.map((code, index) => [code, `${index + 1}.37`]));
    const lookup = (from: CurrencyCode): Rate | null => {
        const fromRate = rates.get(from);

        return fromRate ? { from: fromRate, to: '1' } : null;
    };
    const list = codes.flatMap(code =>
        Array.from({ length: 2_000 }, (_, index) => money(BigInt(index * 37 - 30_000), code)),
    );
    const started = performance.now();
    const summary = summarizeBalances(list, currencyCode('USD'), lookup);
    const elapsed = performance.now() - started;

    expect(summary.converted).toBe(true);
    // Typically a few ms; the bound is generous so a slow CI runner does not flake.
    expect(elapsed).toBeLessThan(1_000);
});
