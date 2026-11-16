import { expect, test } from 'vitest';

import { stringifyWireJson } from 'shared/api/wireJson';
import type { Money } from 'shared/money';
import { convert, currencyCode, fromUnits, MoneyWireError } from 'shared/money';

import { toSettleUpWire } from './toSettleUpWire';

const usd = (units: bigint) => fromUnits(units, currencyCode('USD'));

test('the amount is written as a scale-4 decimal literal from ledger units, the currency is the amount’s', () => {
    expect(
        stringifyWireJson(
            toSettleUpWire({ fromUserId: 'user-1', toUserId: 'user-2', amount: usd(33_333n) }),
        ),
    ).toBe(
        '{"type":"SETTLEMENT","settlement":{"fromUserId":"user-1","toUserId":"user-2",' +
            '"amount":3.3333,"currency":"USD"}}',
    );
});

test('a sub-minor debt is sent exactly (0.0040, never 0.01 or 4e-3)', () => {
    expect(
        stringifyWireJson(
            toSettleUpWire({
                groupId: 'group-1',
                fromUserId: 'user-1',
                toUserId: 'user-2',
                amount: usd(40n),
            }),
        ),
    ).toBe(
        '{"type":"SETTLEMENT","groupId":"group-1","settlement":{"fromUserId":"user-1",' +
            '"toUserId":"user-2","amount":0.0040,"currency":"USD"}}',
    );
});

test('never an id; a group only when given', () => {
    const body = toSettleUpWire({ fromUserId: 'a', toUserId: 'b', amount: usd(10_000n) });

    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('groupId');
});

test('an amount that cannot be written is never sent', () => {
    expect(() =>
        toSettleUpWire({ fromUserId: 'a', toUserId: 'b', amount: usd(10n ** 19n) }),
    ).toThrow(MoneyWireError);
});

test('a converted (approximate) amount is refused', () => {
    const approx: Money = convert(usd(10_000n), '2', currencyCode('EUR'));

    expect(() => toSettleUpWire({ fromUserId: 'a', toUserId: 'b', amount: approx })).toThrow(
        TypeError,
    );
});
