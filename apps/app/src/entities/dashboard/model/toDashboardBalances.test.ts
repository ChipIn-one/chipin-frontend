import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import { createWireAmount, currencyCode, fromUnits } from 'shared/money';

import { toDashboardBalances } from './toDashboardBalances';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

const entry = (currency: string, amount: string) => ({
    currency,
    netBalance: createWireAmount(amount),
});

test('maps every balance to exact Money in response order, also beyond 2^39', () => {
    expect(
        toDashboardBalances({
            balances: {
                USD: entry('USD', '899999999999.9997'),
                EUR: entry('EUR', '-9.5'),
            },
        }),
    ).toEqual([
        fromUnits(8_999_999_999_999_997n, currencyCode('USD')),
        fromUnits(-95_000n, currencyCode('EUR')),
    ]);
});

test('leaves out an entry with an unreadable amount or currency and reports it', () => {
    expect(
        toDashboardBalances({
            balances: {
                USD: entry('USD', '1'),
                BAD: entry('EURO', '2'),
                GBP: entry('GBP', '1e3'),
            },
        }),
    ).toEqual([fromUnits(10_000n, currencyCode('USD'))]);
    expect(Sentry.captureMessage).toHaveBeenCalled();
});
