import { expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';

import {
    hasGroupExpenseTarget,
    isGroupExpenseTarget,
} from './expenseTargets';

const creator = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    firstName: 'Owner',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Group',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
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
} satisfies Group;

test('EXP-060 treats a resolved one-member group as an Add Expense target', () => {
    expect(isGroupExpenseTarget(group)).toBe(true);
    expect(isGroupExpenseTarget(null)).toBe(false);
    expect(isGroupExpenseTarget(undefined)).toBe(false);
});

test('EXP-060 requires at least one resolved group for the global group target', () => {
    expect(hasGroupExpenseTarget([])).toBe(false);
    expect(hasGroupExpenseTarget([group])).toBe(true);
});
