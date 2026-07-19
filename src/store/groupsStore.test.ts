import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as chipinApi from 'api/chipin';
import type { Group } from 'api/chipin.types';

import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';

vi.mock('api/chipin', () => ({
    fetchApiUserGroupById: vi.fn(),
    fetchApiUserGroups: vi.fn(),
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
    emoji: '✈️',
    coverUrl: null,
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: [],
} satisfies Group;

describe('groupsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGroupsStore.getState().setInitialGroupsStore();
        useLoadingStore.getState().setInitialLoadingStore();
    });

    test('fetches groups into the groups store and settles list loading', () => {
        const expectedGroups = [group];
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue(expectedGroups);

        const request = useGroupsStore.getState().fetchSetGroups();

        expect(useLoadingStore.getState().group.list).toBe('loading');

        return request.then(fetchedGroups => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledOnce();
            expect(fetchedGroups).toEqual(expectedGroups);
            expect(useGroupsStore.getState().groups).toEqual(expectedGroups);
            expect(useLoadingStore.getState().group.list).toBe('fetched');
        });
    });

    test('uses the same group response for fetch by id', () => {
        vi.mocked(chipinApi.fetchApiUserGroupById).mockResolvedValue(group);

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id)
            .then(fetchedGroup => {
                expect(fetchedGroup).toEqual(group);
                expect(useGroupsStore.getState().selectedGroup).toEqual(group);
                expect(useLoadingStore.getState().group.data).toBe('fetched');
            });
    });

    test('reuses the selected group instead of fetching by id after card navigation', () => {
        useGroupsStore.getState().setSelectedGroup(group);

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id)
            .then(fetchedGroup => {
                expect(fetchedGroup).toEqual(group);
                expect(chipinApi.fetchApiUserGroupById).not.toHaveBeenCalled();
            });
    });

    test('reuses a cached group on browser back instead of fetching by id', () => {
        const otherGroup = { ...group, id: 'group-2', name: 'Other Group' } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue([group, otherGroup]);

        return useGroupsStore
            .getState()
            .fetchSetGroups()
            .then(() => {
                useGroupsStore.getState().setSelectedGroup(otherGroup);
                return useGroupsStore.getState().fetchSetGroupById(group.id);
            })
            .then(fetchedGroup => {
                expect(fetchedGroup).toEqual(group);
                expect(useGroupsStore.getState().selectedGroup).toEqual(group);
                expect(chipinApi.fetchApiUserGroupById).not.toHaveBeenCalled();
            });
    });
});
