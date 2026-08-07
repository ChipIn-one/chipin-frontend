import { describe, expect, test, vi } from 'vitest';

import {
    createApiGroup,
    fetchApiDashboard,
    fetchApiUserGroupById,
    fetchApiUserGroups,
    inviteApiUserToGroup,
    updateApiGroup,
} from './chipin';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        get: vi.fn(),
        patch: vi.fn(),
        post: vi.fn(),
    },
}));

const parentEvent = {
    id: 'activity-parent',
    seq: 1,
    domain: 'GROUP',
    action: 'GROUP_CREATED',
    actorUserId: 'user-1',
    actorSnapshot: {
        displayName: 'Owner',
        picture: null,
    },
    subjectType: 'group',
    subjectId: 'group-1',
    groupId: 'group-1',
    metadata: {
        type: 'group',
        groupId: 'group-1',
        groupName: 'Vietnam',
        targetUserDisplayName: null,
    },
    createdAt: 1,
    parentActivityId: null,
};

const lastEvent = {
    ...parentEvent,
    id: 'activity-child',
    seq: 2,
    action: 'GROUP_UPDATED',
    createdAt: 2,
    parentActivityId: parentEvent.id,
};

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

const groupResponse = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: {
        items: [{ parent: parentEvent, lastEvent }],
        nextCursor: 1,
    },
};

describe('embedded activity feed responses', () => {
    test('returns activity feed items from the dashboard response', () => {
        vi.mocked(apiInstance.get).mockResolvedValue({
            data: {
                balances: {},
                activity: {
                    items: [{ parent: parentEvent, lastEvent }],
                    nextCursor: 1,
                },
            },
        });

        return fetchApiDashboard().then(result => {
            expect(result.activity).toEqual({
                items: [{ parent: parentEvent, lastEvent }],
                nextCursor: 1,
            });
        });
    });

    test('returns the complete paginated group list response', () => {
        const response = {
            items: [groupResponse],
            nextCursor: 2,
        };
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchApiUserGroups().then(result => {
            expect(result).toEqual(response);
        });
    });

    test('returns activity feed items from a single group response', () => {
        vi.mocked(apiInstance.get).mockResolvedValue({ data: groupResponse });

        return fetchApiUserGroupById(groupResponse.id).then(result => {
            expect(result.recentActivities).toEqual(groupResponse.recentActivities);
        });
    });

    test('returns activity feed items from a created group response', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: groupResponse });

        return createApiGroup({ groupName: groupResponse.name }).then(result => {
            expect(result.recentActivities).toEqual(groupResponse.recentActivities);
        });
    });

    test('returns activity feed items from an updated group response', () => {
        vi.mocked(apiInstance.patch).mockResolvedValue({ data: groupResponse });

        return updateApiGroup({
            groupId: groupResponse.id,
            groupName: groupResponse.name,
            groupDescription: '',
        }).then(result => {
            expect(apiInstance.patch).toHaveBeenCalledWith(`/groups/${groupResponse.id}`, {
                name: groupResponse.name,
                description: '',
            });
            expect(result.recentActivities).toEqual(groupResponse.recentActivities);
        });
    });
});

describe('inviteApiUserToGroup', () => {
    test('returns activity feed items from the joined group response', () => {
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
            coverUrl: null,
            role: 'MEMBER' as const,
            status: 'ACTIVE' as const,
            recentActivities: {
                items: [{ parent: parentEvent, lastEvent }],
                nextCursor: null,
            },
        };

        vi.mocked(apiInstance.post).mockResolvedValue({ data: group });

        return inviteApiUserToGroup({ inviteToken: group.inviteToken }).then(result => {
            expect(result.recentActivities).toEqual(group.recentActivities);
        });
    });
});
