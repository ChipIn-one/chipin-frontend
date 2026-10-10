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

test('EXP-060 excludes a one-member group from expense targets', () => {
    expect(isGroupExpenseTarget(group)).toBe(false);
    expect(isGroupExpenseTarget({ ...group, members: [...group.members, group.members[0]] })).toBe(true);
    expect(isGroupExpenseTarget(null)).toBe(false);
    expect(isGroupExpenseTarget(undefined)).toBe(false);
});

test('EXP-060 requires a group with two members for the global group target', () => {
    expect(hasGroupExpenseTarget([])).toBe(false);
    expect(hasGroupExpenseTarget([group])).toBe(false);
    expect(hasGroupExpenseTarget([{ ...group, members: [...group.members, group.members[0]] }])).toBe(true);
});
