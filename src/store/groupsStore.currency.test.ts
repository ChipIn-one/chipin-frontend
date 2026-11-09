import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import * as chipinApi from 'api/chipin';
import type { Group } from 'api/chipin.types';
import { groupDetailQueryOptions, groupsKeys } from 'entities/groups';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';

vi.mock('api/chipin', () => ({
    fetchApiUserGroupById: vi.fn(),
}));

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: 'Berlin trip expenses',
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: 'USD',
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

let userCache: UserDashboardCache;

beforeEach(() => {
    vi.clearAllMocks();
    userCache = mountUserDashboardCache();
    useErrorsStore.getState().resetErrors();
    useGroupsStore.getState().setInitialGroupsStore();
    useLoadingStore.getState().setInitialLoadingStore();
});

afterEach(() => {
    userCache.dispose();
});

test('a detail refresh replaces the cached group, its last used currency included', () => {
    const refreshedGroup = {
        ...group,
        lastUsedCurrency: 'KHR',
        updatedAt: 2,
    } satisfies Group;

    // Loaded before the detail read below.
    userCache.client.setQueryData(groupsKeys.list(), groupsListData([group]), {
        updatedAt: Date.now() - 1_000,
    });
    userCache.client.setQueryData(groupsKeys.detail(group.id), group);
    vi.mocked(chipinApi.fetchApiUserGroupById).mockResolvedValue(refreshedGroup);

    return userCache.client
        .fetchQuery({ ...groupDetailQueryOptions(group.id), staleTime: 0 })
        .then(result => {
            expect(result).toEqual(refreshedGroup);
            expect(cachedGroupsList(userCache.client)).toEqual([refreshedGroup]);
            expect(userCache.client.getQueryData(groupsKeys.detail(group.id))).toEqual(
                refreshedGroup,
            );
        });
});
