import { expect, test } from 'vitest';

import type { WireDecimal } from 'shared/money';

import { toCurrencyRates } from './toCurrencyRates';

const decimal = (text: string) => text as WireDecimal;

test('toCurrencyRates keeps every rate as its decimal text and copies the snapshot fields', () => {
    expect(
        toCurrencyRates({
            base: 'USD',
            timestamp: 1_779_124_146,
            fetchedAt: 1_779_124_200,
            stale: true,
            rates: { EUR: decimal('0.92'), VND: decimal('25900.123456') },
        }),
    ).toEqual({
        base: 'USD',
        timestamp: 1_779_124_146,
        fetchedAt: 1_779_124_200,
        stale: true,
        rates: { EUR: '0.92', VND: '25900.123456' },
    });
});
