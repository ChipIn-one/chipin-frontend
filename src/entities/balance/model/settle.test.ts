import { describe, expect, test } from 'vitest';

import type { Money } from 'shared/money';
import { currencyCode, fromUnits, moneyLedgerText, parseMoneyInput } from 'shared/money';

import { halfSettlePrefill, oneMinor, resolveSettleAmount, settlePrefill } from './settle';

// Amounts are written as ledger decimals of scale 4 ("3.3333" → 33_333n).
const money = (decimal: string, currency = 'USD'): Money => {
    const [integer = '0', fraction = ''] = decimal.split('.');

    return fromUnits(BigInt(`${integer}${fraction.padEnd(4, '0')}`), currencyCode(currency));
};

const text = (amount: Money | null): string | null => amount && moneyLedgerText(amount);

describe('resolveSettleAmount (spec 03 §4.5, §8)', () => {
    test.each([
        ['USD', '3.3333', '3.33', '3.3333'],
        ['USD', '3.3350', '3.33', '3.3350'],
        ['USD', '3.3350', '3.34', '3.3350'],
        ['USD', '3.3333', '3.32', '3.3200'],
        ['USD', '3.3333', '3.35', null],
        ['USD', '0.0001', '0.01', '0.0001'],
        ['JPY', '10.4000', '10', '10.4000'],
    ])('%s owed %s, input %s → %s', (currency, owed, input, expected) => {
        expect(text(resolveSettleAmount(money(input, currency), money(owed, currency)))).toBe(
            expected,
        );
    });

    test('the full debt is returned as the same exact amount', () => {
        const owed = money('3.3333');

        expect(resolveSettleAmount(money('3.33'), owed)).toBe(owed);
        expect(resolveSettleAmount(owed, owed)).toBe(owed);
    });

    test('property (1000 seeded cases): owed − result is 0 or at least one minor unit', () => {
        let seed = 20261116;
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const currencies = ['USD', 'JPY', 'KWD'] as const;

        for (let index = 0; index < 1000; index += 1) {
            const currency = currencyCode(currencies[index % currencies.length] ?? 'USD');
            const owed = fromUnits(1n + BigInt(Math.floor(random() * 10_000_000)), currency);
            // Inputs as a user types them: whole minor units, around and below the debt.
            const step = oneMinor(currency).minor;
            const input = fromUnits(
                BigInt(Math.floor(random() * Number(owed.minor / step + 3n))) * step,
                currency,
            );
            const result = resolveSettleAmount(input, owed);

            if (result === null) {
                expect(input.minor > owed.minor).toBe(true);
                continue;
            }
            const remainder = owed.minor - result.minor;

            expect(remainder === 0n || remainder >= step).toBe(true);
        }
    });
});

describe('settlePrefill', () => {
    test.each([
        ['USD', '3.3333', '3.3300'],
        ['USD', '3.3350', '3.3400'],
        ['USD', '0.0040', '0.0100'],
        ['USD', '0.0001', '0.0100'],
        ['JPY', '10.4000', '10.0000'],
        ['JPY', '0.4000', '1.0000'],
        ['KWD', '1.2345', '1.2350'],
    ])('%s owed %s → %s', (currency, owed, expected) => {
        expect(text(settlePrefill(money(owed, currency)))).toBe(expected);
    });

    test('a sub-minor debt: the prefill 0.01 sends exactly the debt', () => {
        const owed = money('0.0040');

        expect(resolveSettleAmount(settlePrefill(owed), owed)).toBe(owed);
    });

    test('the prefill is always valid field input of its currency', () => {
        const prefill = settlePrefill(money('24.5678', 'BZD'));

        expect(parseMoneyInput('24.57', currencyCode('BZD'))).toEqual(prefill);
    });
});

describe('halfSettlePrefill', () => {
    test.each([
        ['USD', '100', '50.0000'],
        ['EUR', '30.1234', '15.0600'],
        ['BDT', '90', '45.0000'],
        ['USD', '0.0003', '0.0100'],
        ['JPY', '7', '4.0000'],
    ])('%s owed %s → %s', (currency, owed, expected) => {
        expect(text(halfSettlePrefill(money(owed, currency)))).toBe(expected);
    });
});
