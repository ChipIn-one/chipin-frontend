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

const secondMember = {
    ...creator,
    id: 'user-2',
    email: 'member@example.com',
    displayName: 'Member',
    firstName: 'Member',
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

test('EXP-060 requires enough participants for a group expense target', () => {
    expect(isGroupExpenseTarget(group)).toBe(false);
    expect(
        isGroupExpenseTarget({
            ...group,
            members: [
                ...group.members,
                { user: secondMember, balancesByCurrency: {} },
            ],
        }),
    ).toBe(true);
});

test('EXP-060 finds a ready group among unavailable groups', () => {
    expect(hasGroupExpenseTarget([group])).toBe(false);
    expect(
        hasGroupExpenseTarget([
            group,
            {
                ...group,
                id: 'group-2',
                members: [
                    ...group.members,
                    { user: secondMember, balancesByCurrency: {} },
                ],
            },
        ]),
    ).toBe(true);
});
