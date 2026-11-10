import { expect, test } from 'vitest';

import type { Group } from 'entities/groups';
import { getOrThrow } from 'test/getOrThrow';
import { groupBalances } from 'test/groupFixtures';

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
                balancesByCurrency: groupBalances({ USD: 40 }),
            },
            {
                user: { ...user, id: 'user-2' },
                balancesByCurrency: groupBalances({ USD: 2.75, EUR: -10 }),
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: 'https://cdn.example.com/group.webp',
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
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
                balancesByCurrency: groupBalances({ USD: 20 }),
            },
            {
                user: { ...currentUser, id: 'user-3' },
                balancesByCurrency: groupBalances({ USD: -20 }),
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: 'https://cdn.example.com/group.webp',
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
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
                balancesByCurrency: groupBalances({ USD: -100 }),
            },
            {
                user: { ...currentUser, id: 'user-2', displayName: 'Owes Alice' },
                balancesByCurrency: groupBalances({ EUR: 25 }),
            },
            {
                user: { ...currentUser, id: 'user-3', displayName: 'Settled' },
                balancesByCurrency: groupBalances({ USD: 0 }),
            },
            {
                user: { ...currentUser, id: 'user-4', displayName: 'Alice Owes' },
                balancesByCurrency: groupBalances({ USD: -12, EUR: 8 }),
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: 'https://cdn.example.com/group.webp',
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
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
                balancesByCurrency: groupBalances({ USD: -100 }),
            },
            {
                user: { ...currentUser, id: 'user-2', displayName: 'Owes Alice' },
                balancesByCurrency: groupBalances({ EUR: 25 }),
            },
            {
                user: { ...currentUser, id: 'user-3', displayName: 'Settled' },
                balancesByCurrency: groupBalances({ USD: 0 }),
            },
            {
                user: { ...currentUser, id: 'user-4', displayName: 'Alice Owes' },
                balancesByCurrency: groupBalances({ USD: -12, EUR: 8 }),
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: 'https://cdn.example.com/group.webp',
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
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

test('keeps non-zero group balances and skips float-noise zero balances', () => {
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
                balancesByCurrency: groupBalances({ USD: 0.1, GBP: 5.5e-17 }),
            },
            {
                user: { ...user, id: 'user-2' },
                balancesByCurrency: groupBalances({ USD: 0.2, EUR: -10, GBP: -0.00004 }),
            },
        ],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: null,
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
        recentActivities: {
            items: [],
            nextCursor: null,
        },
    };

    expect(selectGroupBalances(group)).toEqual({
        owedEntries: [{ currency: 'USD', netBalance: 0.3 }],
        oweEntries: [{ currency: 'EUR', netBalance: -10 }],
    });

    const settlementOptions = selectGroupSettlementOptions(group, 'user-1');

    expect(settlementOptions.owedToYou).toEqual([
        {
            user: getOrThrow(group.members, 1).user,
            balances: [{ currency: 'USD', netBalance: 0.2 }],
        },
    ]);
    expect(settlementOptions.youOwe).toEqual([
        {
            user: getOrThrow(group.members, 1).user,
            balances: [{ currency: 'EUR', netBalance: -10 }],
        },
    ]);
});
