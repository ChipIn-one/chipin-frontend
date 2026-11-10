import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group } from 'api/chipin.types';
import { groupDetailQueryOptions, groupsKeys } from 'entities/groups';
import { toTestGroup } from 'test/groupFixtures';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';

const server = setupMswServer();

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
    userCache.client.setQueryData(groupsKeys.list(), groupsListData([toTestGroup(group)]), {
        updatedAt: Date.now() - 1_000,
    });
    userCache.client.setQueryData(groupsKeys.detail(group.id), toTestGroup(group));
    server.use(http.get('*/groups/group-1', () => HttpResponse.json(refreshedGroup)));

    return userCache.client
        .fetchQuery({ ...groupDetailQueryOptions(group.id), staleTime: 0 })
        .then(result => {
            expect(result).toEqual(toTestGroup(refreshedGroup));
            expect(cachedGroupsList(userCache.client)).toEqual([toTestGroup(refreshedGroup)]);
            expect(userCache.client.getQueryData(groupsKeys.detail(group.id))).toEqual(
                toTestGroup(refreshedGroup),
            );
        });
});
