import { expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';

import { selectGroupBalances, selectGroupSettlementOptions } from './groupsSelectors';

test('aggregates group member balances by currency and direction', () => {
    const user = {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    };
    const group: Group = {
        id: 'group-1',
        name: 'Weekend Trip',
        inviteToken: 'invite-token',
        description: null,
        creator: user,
        members: [
            {
                user,
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: 40 },
                },
            },
            {
                user: { ...user, id: 'user-2' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: 2.75 },
                    EUR: { currency: 'EUR', netBalance: -10 },
                },
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        emoji: null,
        coverUrl: null,
        role: 'OWNER',
        status: 'ACTIVE',
        recentActivities: {
            items: [],
            nextCursor: null,
        },
    };

    expect(selectGroupBalances(group)).toEqual({
        owedEntries: [{ currency: 'USD', netBalance: 42.75 }],
        oweEntries: [{ currency: 'EUR', netBalance: -10 }],
    });
});

test('keeps opposite balances in the same currency as separate debts', () => {
    const currentUser = {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    };
    const group: Group = {
        id: 'group-1',
        name: 'Vietnam',
        inviteToken: 'invite-token',
        description: null,
        creator: currentUser,
        members: [
            { user: currentUser, balancesByCurrency: {} },
            {
                user: { ...currentUser, id: 'user-2' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: 20 },
                },
            },
            {
                user: { ...currentUser, id: 'user-3' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -20 },
                },
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        emoji: null,
        coverUrl: null,
        role: 'OWNER',
        status: 'ACTIVE',
        recentActivities: {
            items: [],
            nextCursor: null,
        },
    };

    expect(selectGroupBalances(group)).toEqual({
        owedEntries: [{ currency: 'USD', netBalance: 20 }],
        oweEntries: [{ currency: 'USD', netBalance: -20 }],
    });
});

test('groups settlement options by direction and splits mixed member balances', () => {
    const currentUser = {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    };
    const group: Group = {
        id: 'group-1',
        name: 'Weekend Trip',
        inviteToken: 'invite-token',
        description: null,
        creator: currentUser,
        members: [
            {
                user: currentUser,
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -100 },
                },
            },
            {
                user: { ...currentUser, id: 'user-2', displayName: 'Owes Alice' },
                balancesByCurrency: {
                    EUR: { currency: 'EUR', netBalance: 25 },
                },
            },
            {
                user: { ...currentUser, id: 'user-3', displayName: 'Settled' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: 0 },
                },
            },
            {
                user: { ...currentUser, id: 'user-4', displayName: 'Alice Owes' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -12 },
                    EUR: { currency: 'EUR', netBalance: 8 },
                },
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        emoji: null,
        coverUrl: null,
        role: 'OWNER',
        status: 'ACTIVE',
        recentActivities: {
            items: [],
            nextCursor: null,
        },
    };

    expect(selectGroupSettlementOptions(group, currentUser.id)).toEqual({
        youOwe: [
            {
                user: expect.objectContaining({ id: 'user-4' }),
                balances: [{ currency: 'USD', netBalance: -12 }],
            },
        ],
        owedToYou: [
            {
                user: expect.objectContaining({ id: 'user-2' }),
                balances: [{ currency: 'EUR', netBalance: 25 }],
            },
            {
                user: expect.objectContaining({ id: 'user-4' }),
                balances: [{ currency: 'EUR', netBalance: 8 }],
            },
        ],
    });
});

test('groups settlement options by direction and splits mixed member balances', () => {
    const currentUser = {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    };
    const group: Group = {
        id: 'group-1',
        name: 'Weekend Trip',
        inviteToken: 'invite-token',
        description: null,
        creator: currentUser,
        members: [
            {
                user: currentUser,
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -100 },
                },
            },
            {
                user: { ...currentUser, id: 'user-2', displayName: 'Owes Alice' },
                balancesByCurrency: {
                    EUR: { currency: 'EUR', netBalance: 25 },
                },
            },
            {
                user: { ...currentUser, id: 'user-3', displayName: 'Settled' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: 0 },
                },
            },
            {
                user: { ...currentUser, id: 'user-4', displayName: 'Alice Owes' },
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -12 },
                    EUR: { currency: 'EUR', netBalance: 8 },
                },
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        emoji: null,
        coverUrl: null,
        role: 'OWNER',
        status: 'ACTIVE',
        recentActivities: {
            items: [],
            nextCursor: null,
        },
    };

    expect(selectGroupSettlementOptions(group, currentUser.id)).toEqual({
        youOwe: [
            {
                user: expect.objectContaining({ id: 'user-4' }),
                balances: [{ currency: 'USD', netBalance: -12 }],
            },
        ],
        owedToYou: [
            {
                user: expect.objectContaining({ id: 'user-2' }),
                balances: [{ currency: 'EUR', netBalance: 25 }],
            },
            {
                user: expect.objectContaining({ id: 'user-4' }),
                balances: [{ currency: 'EUR', netBalance: 8 }],
            },
        ],
    });
});
