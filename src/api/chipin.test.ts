import { describe, expect, test, vi } from 'vitest';

import { inviteApiUserToGroup } from './chipin';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        post: vi.fn(),
    },
}));

describe('inviteApiUserToGroup', () => {
    test('returns the canonical group response without transformation', () => {
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
        const joinedUser = {
            ...creator,
            id: 'user-2',
            email: 'member@example.com',
            displayName: 'Member',
        };
        const group = {
            id: 'group-1',
            name: 'Vietnam',
            inviteToken: 'invite-token',
            description: null,
            creator,
            members: [
                { user: creator, balancesByCurrency: {} },
                {
                    user: joinedUser,
                    balancesByCurrency: {
                        USD: { currency: 'USD', netBalance: -25 },
                    },
                },
            ],
            createdAt: 1,
            updatedAt: 1,
            emoji: '🌿',
            coverUrl: null,
            role: 'MEMBER' as const,
            status: 'ACTIVE' as const,
            recentActivities: [],
        };

        vi.mocked(apiInstance.post).mockResolvedValue({ data: group });

        return inviteApiUserToGroup({ inviteToken: group.inviteToken }).then(result => {
            expect(result).toEqual(group);
        });
    });
});
