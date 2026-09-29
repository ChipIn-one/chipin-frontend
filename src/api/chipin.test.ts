import { describe, expect, test, vi } from 'vitest';

import {
    createApiGroup,
    fetchApiCurrencyRates,
    fetchApiDashboard,
    fetchApiUserGroupById,
    fetchApiUserGroups,
    inviteApiUserToGroup,
    removeApiGroup,
} from './chipin';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        delete: vi.fn(),
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
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [{ parent: parentEvent, lastEvent }],
        nextCursor: 1,
    },
};

describe('embedded activity feed responses', () => {
    test('returns activity feed items from the dashboard response', () => {
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({
            data: {
                balances: {},
                activity: {
                    items: [{ parent: parentEvent, lastEvent }],
                    nextCursor: 1,
                },
            },
        });

        return fetchApiDashboard(controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/dashboard', {
                signal: controller.signal,
            });
            expect(result.activity).toEqual({
                items: [{ parent: parentEvent, lastEvent }],
                nextCursor: 1,
            });
        });
    });

    test('returns the complete paginated group list response', () => {
        const controller = new AbortController();
        const response = {
            items: [groupResponse],
            nextCursor: 'cursor-2',
        };
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchApiUserGroups(controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/groups', {
                signal: controller.signal,
            });
            expect(result).toEqual(response);
        });
    });

    test('fetches one canonical group by id with cancellation support', () => {
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: groupResponse });

        return fetchApiUserGroupById(groupResponse.id, controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith(`/groups/${groupResponse.id}`, {
                signal: controller.signal,
            });
            expect(result).toEqual(groupResponse);
        });
    });

    test('forwards cancellation to currency rates', () => {
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: { rates: {} } });

        return fetchApiCurrencyRates(controller.signal).then(() => {
            expect(apiInstance.get).toHaveBeenCalledWith('/currency-rates', {
                params: { base: 'USD' },
                signal: controller.signal,
            });
        });
    });

    test('returns activity feed items from a created group response', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: groupResponse });

        return createApiGroup({ groupName: groupResponse.name }).then(result => {
            expect(result.recentActivities).toEqual(groupResponse.recentActivities);
        });
    });

});

describe('removeApiGroup', () => {
    test('returns no domain object for the 204 response', () => {
        vi.mocked(apiInstance.delete).mockResolvedValue({ data: undefined });

        return removeApiGroup({ groupId: 'group-1' }).then(result => {
            expect(apiInstance.delete).toHaveBeenCalledWith('/groups/group-1');
            expect(result).toBeUndefined();
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
            simplifyDebts: true,
            role: 'MEMBER' as const,
            status: 'ACTIVE' as const,
            lastUsedCurrency: null,
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
