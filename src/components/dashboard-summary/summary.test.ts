import { expect, test } from 'vitest';

import type { CurrencyRates } from 'entities/currency-rates';
import { currencyCode, fromUnits } from 'shared/money';

import { summarizeDashboard } from './summary';

const money = (units: bigint, currency: string) => fromUnits(units, currencyCode(currency));

const ratesOf = (rates: Record<string, string>): CurrencyRates => ({
    base: 'USD',
    timestamp: 1,
    fetchedAt: 1,
    stale: false,
    rates,
});

test('DSH-001 converts the totals into the default currency and sorts the badges', () => {
    expect(
        summarizeDashboard(
            [money(200_000n, 'USD'), money(-90_000n, 'EUR'), money(50_000n, 'GBP')],
            ratesOf({ USD: '1', EUR: '0.9', GBP: '0.5' }),
            'USD',
        ),
    ).toEqual({
        netTotalInBase: 20,
        owedTotalInBase: 30,
        owingTotalInBase: 10,
        owedBadgeItems: [
            { tokenCode: 'USD', value: 20, color: 'grass' },
            { tokenCode: 'GBP', value: 5, color: 'grass' },
        ],
        oweBadgeItems: [{ tokenCode: 'EUR', value: 9, color: 'tomato' }],
    });
});

test('keeps a debt below one minor unit and drops an exact zero', () => {
    const summary = summarizeDashboard(
        [money(40n, 'CHF'), money(0n, 'GBP'), money(-205_000n, 'USD')],
        ratesOf({ CHF: '1' }),
        'USD',
    );

    expect(summary.owedBadgeItems).toEqual([{ tokenCode: 'CHF', value: 0.004, color: 'grass' }]);
    expect(summary.oweBadgeItems).toEqual([{ tokenCode: 'USD', value: 20.5, color: 'tomato' }]);
});

test('leaves out a currency without a usable rate and an invalid default currency', () => {
    expect(
        summarizeDashboard(
            [money(30_000n, 'USD'), money(10_000n, 'EUR')],
            ratesOf({ EUR: 'oops' }),
            'nope',
        ),
    ).toMatchObject({ netTotalInBase: 3, owedTotalInBase: 3, owingTotalInBase: 0 });
});
