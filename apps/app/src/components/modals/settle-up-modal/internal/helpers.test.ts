import { PROP_COLOR } from '@chipin/tokens/theme';
import { expect, test } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import type { Balance } from 'entities/balance';
import { currencyCode, fromUnits, moneyLedgerText } from 'shared/money';

import {
    getDebtOptions,
    getHalfSettlementAmount,
    getSettlementAmount,
    getSettlementViewModel,
    selectSettlementBalance,
} from './helpers';

// The exact balance written as a ledger decimal of scale 4 ("-3.3333" → -33_333n).
const balance = (decimal: string, currency = 'USD'): Balance => {
    const [integer = '0', fraction = ''] = decimal.split('.');

    return {
        net: fromUnits(BigInt(`${integer}${fraction.padEnd(4, '0')}`), currencyCode(currency)),
    };
};

const usd = (decimal: string) => balance(decimal).net;

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const friend = {
    id: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob Builder',
    firstName: 'Bob',
    lastName: 'Builder',
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

test('selects the requested balance and falls back to the first currency', () => {
    const balances = [balance('-100'), balance('25', 'EUR')];

    expect(selectSettlementBalance(balances, 'EUR')).toBe(balances[1]);
    expect(selectSettlementBalance(balances, 'BZD')).toBe(balances[0]);
});

test('throws when there is no balance to settle', () => {
    expect(() => selectSettlementBalance([], 'USD')).toThrow(
        'Settlement requires at least one balance',
    );
});

test('expands member balances into one selectable option per currency', () => {
    const balances = [balance('-100'), balance('-25', 'EUR')];

    expect(getDebtOptions([{ user: friend, balances }])).toEqual([
        { user: friend, balance: balances[0], balances },
        { user: friend, balance: balances[1], balances },
    ]);
});

test('builds a partial payment that sends the input and leaves the rest of the exact debt', () => {
    const model = getSettlementViewModel({
        user: currentUser,
        friend,
        balance: balance('-100'),
        amount: '40',
    });

    expect(model).toMatchObject({
        settlement: { fromUserId: currentUser.id, toUserId: friend.id, amount: usd('40') },
        owed: usd('100'),
        remaining: usd('60'),
        isFriendPayer: false,
        isDebtSettled: false,
        fullSettlementAmount: null,
        debtColor: PROP_COLOR.debtOwing,
        summaryUser: currentUser,
    });
});

test('builds a full settlement when the friend owes', () => {
    const owed = balance('25', 'EUR');

    expect(
        getSettlementViewModel({ user: currentUser, friend, balance: owed, amount: '25' }),
    ).toMatchObject({
        settlement: { fromUserId: friend.id, toUserId: currentUser.id, amount: owed.net },
        isFriendPayer: true,
        isDebtSettled: true,
        fullSettlementAmount: null,
        debtColor: PROP_COLOR.debtOwed,
        summaryUser: friend,
    });
});

test('an input less than one minor unit from the debt sends exactly the debt, with the caption', () => {
    const model = getSettlementViewModel({
        user: currentUser,
        friend,
        balance: balance('-3.3333'),
        amount: '3.33',
    });

    expect(model.settlement?.amount).toEqual(usd('3.3333'));
    expect(model.isDebtSettled).toBe(true);
    expect(model.remaining).toEqual(usd('0'));
    expect(model.fullSettlementAmount && moneyLedgerText(model.fullSettlementAmount)).toBe(
        '3.3333',
    );
});

test.each(['', '0', '-1', '100.01', 'invalid', '0.0000001', '1.234'])(
    'SET-003 disables the settlement amount %j (nothing to send)',
    amount => {
        const model = getSettlementViewModel({
            user: currentUser,
            friend,
            balance: balance('-100'),
            amount,
        });

        expect(model.settlement).toBeNull();
        expect(model.remaining).toEqual(usd('100'));
    },
);

test.each([
    ['100.01', true],
    ['100', false],
    ['0', false],
    ['1.234', false],
])('flags %j as above the 100 debt: %s', (amount, isAboveDebt) => {
    expect(
        getSettlementViewModel({ user: currentUser, friend, balance: balance('-100'), amount })
            .isAboveDebt,
    ).toBe(isAboveDebt);
});

test('a zero amount is not a payment, even for a debt below one minor unit', () => {
    const model = getSettlementViewModel({
        user: currentUser,
        friend,
        balance: balance('-0.0040'),
        amount: '0',
    });

    expect(model.settlement).toBeNull();
    expect(model.isAmountInvalid).toBe(false);
});

test.each([
    ['0.0000001', true],
    ['1.234', true],
    ['abc', true],
    ['', false],
    ['100.01', false],
])('marks %j as not an amount of the currency: %s', (amount, isInvalid) => {
    expect(
        getSettlementViewModel({ user: currentUser, friend, balance: balance('-100'), amount })
            .isAmountInvalid,
    ).toBe(isInvalid);
});

test.each([
    ['-100', '100'],
    ['-24.5678', '24.57'],
    ['-3.3350', '3.34'],
    ['-0.0040', '0.01'],
    ['0.0001', '0.01'],
])('prefills the full %s debt rounded to minor units as %j', (net, expected) => {
    expect(getSettlementAmount(balance(net))).toBe(expected);
});

test.each([
    ['-100', '50'],
    ['25', '12.5'],
    ['-30.1234', '15.06'],
    ['-24.5678', '12.28'],
    ['-0.0003', '0.01'],
    ['-0.0001', '0.01'],
])('takes half of a %s debt in minor units as %j', (net, expected) => {
    expect(getHalfSettlementAmount(balance(net))).toBe(expected);
});
