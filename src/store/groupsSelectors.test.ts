import { expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';

import { selectGroupBalances } from './groupsSelectors';

test('aggregates group member balances by currency', () => {
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
        recentActivities: [],
    };

    expect(selectGroupBalances(group)).toEqual({
        USD: { currency: 'USD', netBalance: 42.75 },
        EUR: { currency: 'EUR', netBalance: -10 },
    });
});
