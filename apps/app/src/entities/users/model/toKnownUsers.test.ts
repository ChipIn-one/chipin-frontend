import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import { createWireAmount, currencyCode, fromUnits } from 'shared/money';

import { toKnownUsers } from './toKnownUsers';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

const wireUser = (id: string) => ({
    id,
    email: `${id}@example.com`,
    displayName: `User ${id}`,
    createdAt: 1,
    updatedAt: 2,
});

const balance = (currency: string, amount: string) => ({
    currency,
    netAmount: createWireAmount(amount),
});

test('maps the known users to the domain with exact Money, also beyond 2^39', () => {
    expect(
        toKnownUsers({
            friends: [
                {
                    user: { ...wireUser('friend-1'), picture: 'https://example.com/a.png' },
                    balances: [balance('USD', '899999999999.9997'), balance('EUR', '-25.5')],
                    lastUsedCurrency: 'USD',
                    lastSelectedCurrency: null,
                },
                {
                    user: wireUser('friend-2'),
                    balances: [],
                    lastUsedCurrency: null,
                    lastSelectedCurrency: null,
                },
            ],
        }),
    ).toEqual([
        {
            user: {
                ...wireUser('friend-1'),
                firstName: null,
                lastName: null,
                picture: 'https://example.com/a.png',
            },
            balances: [
                { net: fromUnits(8_999_999_999_999_997n, currencyCode('USD')) },
                { net: fromUnits(-255_000n, currencyCode('EUR')) },
            ],
            hasUnreadableBalance: false,
            lastUsedCurrency: 'USD',
        },
        {
            user: { ...wireUser('friend-2'), firstName: null, lastName: null, picture: null },
            balances: [],
            hasUnreadableBalance: false,
            lastUsedCurrency: null,
        },
    ]);
});

test('leaves an unreadable balance out, marks the friend and reports it without user data', () => {
    const [friend] = toKnownUsers({
        friends: [
            {
                user: wireUser('friend-1'),
                balances: [
                    balance('USD', '1'),
                    balance('EURO', '2'),
                    balance('GBP', '1e3'),
                    balance('JPY', '1.23456'),
                ],
                lastUsedCurrency: null,
                lastSelectedCurrency: null,
            },
        ],
    });

    expect(friend?.balances).toEqual([{ net: fromUnits(10_000n, currencyCode('USD')) }]);
    expect(friend?.hasUnreadableBalance).toBe(true);
    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('friend-1');
});
