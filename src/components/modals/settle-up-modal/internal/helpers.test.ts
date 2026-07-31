import { expect, test } from 'vitest';

import type { User } from 'api/chipin.types';

import {
    getDebtOptions,
    getSettlementViewModel,
    selectSettlementBalance,
} from './helpers';

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
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
} satisfies User;

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
    const balances = [
        { currency: 'USD', netAmount: -100 },
        { currency: 'EUR', netAmount: 25 },
    ];

    expect(selectSettlementBalance(balances, 'EUR')).toEqual(balances[1]);
    expect(selectSettlementBalance(balances, 'BZD')).toEqual(balances[0]);
});

test('expands member balances into one selectable option per currency', () => {
    expect(
        getDebtOptions([
            {
                user: friend,
                balances: [
                    { currency: 'USD', netBalance: -100 },
                    { currency: 'EUR', netBalance: -25 },
                ],
            },
        ]),
    ).toEqual([
        {
            user: friend,
            balance: { currency: 'USD', netAmount: -100 },
            balances: [
                { currency: 'USD', netAmount: -100 },
                { currency: 'EUR', netAmount: -25 },
            ],
        },
        {
            user: friend,
            balance: { currency: 'EUR', netAmount: -25 },
            balances: [
                { currency: 'USD', netAmount: -100 },
                { currency: 'EUR', netAmount: -25 },
            ],
        },
    ]);
});

test('builds a partial payment model when the current user owes', () => {
    expect(
        getSettlementViewModel({
            user: currentUser,
            friend,
            balance: { currency: 'USD', netAmount: -100 },
            amount: '40',
        }),
    ).toMatchObject({
        params: {
            fromUserId: currentUser.id,
            toUserId: friend.id,
            amount: 40,
            currency: 'USD',
        },
        maxAmount: 100,
        remainingAmount: 60,
        isFriendPayer: false,
        isSubmitDisabled: false,
        isDebtSettled: false,
        debtColor: 'red',
        summaryUser: currentUser,
    });
});

test('builds a fully settled model when the friend owes', () => {
    expect(
        getSettlementViewModel({
            user: currentUser,
            friend,
            balance: { currency: 'EUR', netAmount: 25 },
            amount: '25',
        }),
    ).toMatchObject({
        params: {
            fromUserId: friend.id,
            toUserId: currentUser.id,
            amount: 25,
            currency: 'EUR',
        },
        remainingAmount: 0,
        isFriendPayer: true,
        isSubmitDisabled: false,
        isDebtSettled: true,
        debtColor: 'green',
        summaryUser: friend,
    });
});

test.each(['', '0', '-1', '100.01', 'invalid'])(
    'disables invalid settlement amount %s',
    amount => {
        const model = getSettlementViewModel({
            user: currentUser,
            friend,
            balance: { currency: 'USD', netAmount: -100 },
            amount,
        });

        expect(model.isSubmitDisabled).toBe(true);
    },
);
