import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as activityApi from 'api/activityApi';
import * as chipinApi from 'api/chipin';
import type { ActivityFeedItem, Group } from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';

import { useActivityStore } from './activity-store';
import { useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

vi.mock('api/chipin', () => ({
    createApiGroup: vi.fn(),
    fetchApiUserGroupById: vi.fn(),
    fetchApiUserGroups: vi.fn(),
    inviteApiUserToGroup: vi.fn(),
    kickApiGroupMember: vi.fn(),
    leaveApiGroup: vi.fn(),
    removeApiGroup: vi.fn(),
}));

vi.mock('api/activityApi', () => ({
    fetchActivities: vi.fn(),
    fetchActivityChildren: vi.fn(),
    fetchActivityPreviews: vi.fn(),
    fetchGroupActivityPreviews: vi.fn(),
}));

vi.mock('api/groupsApi', () => ({
    uploadGroupCover: vi.fn(),
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
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const createActivityItem = (parentId: string): ActivityFeedItem => ({
    parent: { id: parentId } as ActivityFeedItem['parent'],
    lastEvent: { id: `event-${parentId}` } as ActivityFeedItem['lastEvent'],
});

const createGroupWithActivity = (
    items: ActivityFeedItem[],
    nextCursor: number | null,
): Group => ({
    ...group,
    recentActivities: { items, nextCursor },
});

describe('groupsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useErrorsStore.getState().resetErrors();
        useGroupsStore.getState().setInitialGroupsStore();
        useLoadingStore.getState().setInitialLoadingStore();
    });

    test('fetches groups into the groups store and settles list loading', () => {
        const expectedGroups = [group];
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: expectedGroups,
            nextCursor: 'cursor-2',
        });

        const request = useGroupsStore.getState().fetchSetGroups();

        expect(useLoadingStore.getState().group.list).toBe('loading');

        return request.then(fetchedGroups => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledOnce();
            expect(fetchedGroups).toEqual(expectedGroups);
            expect(useGroupsStore.getState().groups).toEqual(expectedGroups);
            expect(useGroupsStore.getState().groupsNextCursor).toBe('cursor-2');
            expect(useLoadingStore.getState().group.list).toBe('fetched');
        });
    });

    test('replaces the matching cached and selected group after a cover upload', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const updatedGroup = {
            ...group,
            coverUrl: 'https://cdn.example.com/group.webp',
            updatedAt: 2,
        } satisfies Group;

        useGroupsStore.setState({ groups: [group] });
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);

        const request = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file,
        });

        expect(useLoadingStore.getState().group.cover).toBe('loading');

        return request.then(result => {
            expect(result).toEqual(updatedGroup);
            expect(useGroupsStore.getState().groups).toEqual([updatedGroup]);
            expect(useGroupsStore.getState().selectedGroup).toEqual(updatedGroup);
            expect(useLoadingStore.getState().group.cover).toBe('fetched');
        });
    });

    test('does not replace a newer selected group after a cover upload resolves', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const otherGroup = { ...group, id: 'group-2', name: 'Other Group' } satisfies Group;
        const updatedGroup = {
            ...group,
            coverUrl: 'https://cdn.example.com/group.webp',
            updatedAt: 2,
        } satisfies Group;

        useGroupsStore.setState({ groups: [group, otherGroup] });
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);

        const request = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file,
        });

        useGroupsStore.getState().setSelectedGroup(otherGroup);

        return request.then(() => {
            expect(useGroupsStore.getState().groups).toEqual([updatedGroup, otherGroup]);
            expect(useGroupsStore.getState().selectedGroup).toEqual(otherGroup);
        });
    });

    test('settles cover loading and preserves the upload rejection', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const uploadError = new Error('Cover upload failed');

        vi.mocked(groupsApi.uploadGroupCover).mockRejectedValue(uploadError);

        return useGroupsStore
            .getState()
            .uploadGroupCover({ groupId: group.id, file })
            .then(
                () => Promise.reject(new Error('Expected cover upload to reject')),
                error => {
                    expect(error).toBe(uploadError);
                    expect(useLoadingStore.getState().group.cover).toBe('fetched');
                },
            );
    });

    test('refreshes the selected group from the fetched group list', () => {
        const refreshedGroup = {
            ...group,
            name: 'Updated group',
        };

        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [refreshedGroup],
            nextCursor: null,
        });

        return useGroupsStore
            .getState()
            .fetchSetGroups()
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toEqual(
                    refreshedGroup,
                );
            });
    });

    test('fetches a canonical group by id when it is outside the loaded list', () => {
        vi.mocked(chipinApi.fetchApiUserGroupById).mockResolvedValue(group);
        useGroupsStore.setState({ groups: [], selectedGroup: null });

        return useGroupsStore.getState().fetchSetGroupById(group.id).then(result => {
            expect(result).toEqual(group);
            expect(useGroupsStore.getState().selectedGroup).toEqual(group);
        });
    });

    test('continues the selected group activity feed from its embedded cursor', () => {
        const initialItem = createActivityItem('parent-1');
        const secondItem = createActivityItem('parent-2');
        const thirdItem = createActivityItem('parent-3');
        const selectedGroup = createGroupWithActivity([initialItem], 20);
        useGroupsStore.getState().setSelectedGroup(selectedGroup);
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockResolvedValue({
            items: [secondItem, thirdItem],
            nextCursor: null,
        });

        const request = useGroupsStore.getState().fetchMoreGroupActivity();

        expect(useLoadingStore.getState().group.nextPage).toBe('loading');

        return request.then(() => {
            expect(activityApi.fetchGroupActivityPreviews).toHaveBeenCalledWith(
                { groupId: group.id, limit: 20, cursor: 20 },
                expect.any(AbortSignal),
            );
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual([
                initialItem,
                secondItem,
                thirdItem,
            ]);
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor).toBeNull();
            expect(useLoadingStore.getState().group.nextPage).toBe('fetched');
        });
    });

    test('deduplicates group activity previews by parent id in API order', () => {
        const initialItems = [createActivityItem('parent-1'), createActivityItem('parent-2')];
        const incomingItems = [
            createActivityItem('parent-2'),
            createActivityItem('parent-3'),
            createActivityItem('parent-3'),
            createActivityItem('parent-4'),
        ];
        useGroupsStore.getState().setSelectedGroup(createGroupWithActivity(initialItems, 20));
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockResolvedValue({
            items: incomingItems,
            nextCursor: 40,
        });

        return useGroupsStore.getState().fetchMoreGroupActivity().then(() => {
            expect(
                useGroupsStore
                    .getState()
                    .selectedGroup?.recentActivities.items.map(item => item.parent.id),
            ).toEqual(['parent-1', 'parent-2', 'parent-3', 'parent-4']);
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor).toBe(40);
        });
    });

    test('does not issue a duplicate request while the same group cursor is loading', () => {
        let resolveRequest: ((value: { items: []; nextCursor: null }) => void) | undefined;
        const pendingRequest = new Promise<{ items: []; nextCursor: null }>(resolve => {
            resolveRequest = resolve;
        });
        useGroupsStore.getState().setSelectedGroup(createGroupWithActivity([], 20));
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockReturnValue(pendingRequest);

        const firstRequest = useGroupsStore.getState().fetchMoreGroupActivity();
        const duplicateRequest = useGroupsStore.getState().fetchMoreGroupActivity();

        expect(activityApi.fetchGroupActivityPreviews).toHaveBeenCalledOnce();

        resolveRequest?.({ items: [], nextCursor: null });

        return Promise.all([firstRequest, duplicateRequest]);
    });

    test('preserves confirmed group activity and cursor after a page failure and retries the same cursor', () => {
        const initialItems = [createActivityItem('parent-1')];
        const requestError = new Error('Group activity unavailable');
        useGroupsStore.getState().setSelectedGroup(createGroupWithActivity(initialItems, 20));
        vi.mocked(activityApi.fetchGroupActivityPreviews)
            .mockRejectedValueOnce(requestError)
            .mockResolvedValueOnce({ items: [], nextCursor: null });

        return useGroupsStore.getState().fetchMoreGroupActivity().then(() => {
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual(
                initialItems,
            );
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor).toBe(20);
            expect(useLoadingStore.getState().group.nextPage).toBe('fetched');
            expect(useErrorsStore.getState().errors.group.nextPage?.message).toBe(
                requestError.message,
            );

            return useGroupsStore.getState().fetchMoreGroupActivity();
        }).then(() => {
            expect(activityApi.fetchGroupActivityPreviews).toHaveBeenLastCalledWith(
                { groupId: group.id, limit: 20, cursor: 20 },
                expect.any(AbortSignal),
            );
            expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();
        });
    });

    test('ignores a late group activity success after switching groups', () => {
        let resolveRequest: ((value: { items: ActivityFeedItem[]; nextCursor: null }) => void) | undefined;
        const pendingRequest = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>(resolve => {
            resolveRequest = resolve;
        });
        const firstGroup = createGroupWithActivity([], 20);
        const secondGroup = { ...group, id: 'group-2' };
        useGroupsStore.getState().setSelectedGroup(firstGroup);
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockReturnValue(pendingRequest);

        const request = useGroupsStore.getState().fetchMoreGroupActivity();
        useGroupsStore.getState().setSelectedGroup(secondGroup);
        resolveRequest?.({ items: [createActivityItem('stale-parent')], nextCursor: null });

        return request.then(() => {
            expect(useGroupsStore.getState().selectedGroup).toEqual(secondGroup);
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual([]);
            expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();
        });
    });

    test('ignores a late group activity failure after switching groups', () => {
        let rejectRequest: ((reason?: unknown) => void) | undefined;
        const pendingRequest = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>((_, reject) => {
            rejectRequest = reject;
        });
        const firstGroup = createGroupWithActivity([], 20);
        const secondGroup = { ...group, id: 'group-2' };
        const requestError = new Error('Stale group activity failure');
        useGroupsStore.getState().setSelectedGroup(firstGroup);
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockReturnValue(pendingRequest);

        const request = useGroupsStore.getState().fetchMoreGroupActivity();
        useGroupsStore.getState().setSelectedGroup(secondGroup);
        rejectRequest?.(requestError);

        return request.then(() => {
            expect(useGroupsStore.getState().selectedGroup).toEqual(secondGroup);
            expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();
            expect(useLoadingStore.getState().group.nextPage).toBe('fetched');
        });
    });

    test('invalidates group activity pagination during a forced group refresh', () => {
        let resolveActivity: ((value: { items: ActivityFeedItem[]; nextCursor: null }) => void) | undefined;
        let resolveGroup: ((value: Group) => void) | undefined;
        const pendingActivity = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>(resolve => {
            resolveActivity = resolve;
        });
        const pendingGroup = new Promise<Group>(resolve => {
            resolveGroup = resolve;
        });
        const selectedGroup = createGroupWithActivity([], 20);
        const refreshedGroup = createGroupWithActivity([], 40);
        useGroupsStore.getState().setSelectedGroup(selectedGroup);
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockReturnValue(pendingActivity);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(() => pendingGroup);

        const activityRequest = useGroupsStore.getState().fetchMoreGroupActivity();
        const refreshRequest = useGroupsStore.getState().fetchSetGroupById(group.id, true);

        expect(useLoadingStore.getState().group.nextPage).toBe('fetched');
        expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();

        resolveActivity?.({ items: [createActivityItem('stale-parent')], nextCursor: null });
        resolveGroup?.(refreshedGroup);

        return Promise.all([activityRequest, refreshRequest]).then(() => {
            expect(useGroupsStore.getState().selectedGroup).toEqual(refreshedGroup);
            expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual([]);
            expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();
        });
    });

    test('adds and selects the canonical group returned after joining', () => {
        const joinedGroup = { ...group, role: 'MEMBER' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(joinedGroup);

        const request = useGroupsStore.getState().joinGroup({ inviteToken: group.inviteToken });

        expect(useLoadingStore.getState().group.join).toBe('loading');

        return request.then(result => {
            expect(result).toEqual(joinedGroup);
            expect(useGroupsStore.getState().groups).toEqual([joinedGroup]);
            expect(useGroupsStore.getState().selectedGroup).toEqual(joinedGroup);
            expect(useLoadingStore.getState().group.join).toBe('fetched');
        });
    });

    test('does not restore group state when create resolves after reset', () => {
        let resolveCreate: ((value: Group) => void) | undefined;
        vi.mocked(chipinApi.createApiGroup).mockImplementation(() => new Promise(resolve => {
            resolveCreate = resolve;
        }));

        const request = useGroupsStore.getState().createGroup({ groupName: group.name });

        return Promise.resolve()
            .then(() => {
                useGroupsStore.getState().setInitialGroupsStore();
                useLoadingStore.getState().setInitialLoadingStore();
                resolveCreate?.(group);
                return request;
            })
            .then(result => {
                expect(result).toEqual(group);
                expect(useGroupsStore.getState().groups).toEqual([]);
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
                expect(useLoadingStore.getState().group.add).toBe('initial');
            });
    });

    test('does not restore group errors when join rejects after reset', () => {
        let rejectJoin: ((reason?: unknown) => void) | undefined;
        const joinError = new Error('stale join failed');
        vi.mocked(chipinApi.inviteApiUserToGroup).mockImplementation(() => (
            new Promise((_resolve, reject) => {
                rejectJoin = reject;
            })
        ));

        const request = useGroupsStore.getState().joinGroup({
            inviteToken: group.inviteToken,
        });

        return Promise.resolve()
            .then(() => {
                useGroupsStore.getState().setInitialGroupsStore();
                useLoadingStore.getState().setInitialLoadingStore();
                rejectJoin?.(joinError);
                return expect(request).rejects.toBe(joinError);
            })
            .then(() => {
                expect(useErrorsStore.getState().errors.group.join).toBeNull();
                expect(useLoadingStore.getState().group.join).toBe('initial');
            });
    });

    test('removes a group and refetches every affected backend resource', () => {
        const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
        const fetchSetDashboard = vi.fn().mockResolvedValue(undefined);
        const fetchSetFriends = vi.fn().mockResolvedValue(undefined);
        const fetchSetGroups = vi.fn().mockResolvedValue([]);
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity });
        useDashboardStore.setState({ fetchSetDashboard });
        useGroupsStore.setState({ fetchSetGroups });
        useUsersStore.setState({ fetchSetFriends });

        return useGroupsStore.getState().removeGroup({ groupId: group.id }).then(() => {
            expect(fetchSetGroups).toHaveBeenCalledWith(true);
            expect(fetchSetFriends).toHaveBeenCalledWith(true);
            expect(fetchSetDashboard).toHaveBeenCalledWith(true);
            expect(fetchSetActivity).toHaveBeenCalledWith(true);
        });
    });

    test('leaves a group before refetching backend state', () => {
        vi.mocked(chipinApi.leaveApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({
            fetchSetActivity: vi.fn().mockResolvedValue(undefined),
        });
        useDashboardStore.setState({
            fetchSetDashboard: vi.fn().mockResolvedValue(undefined),
        });
        useGroupsStore.setState({
            fetchSetGroups: vi.fn().mockResolvedValue([]),
        });
        useUsersStore.setState({
            fetchSetFriends: vi.fn().mockResolvedValue(undefined),
        });

        return useGroupsStore.getState().leaveGroup({
            groupId: group.id,
            newOwnerId: 'user-2',
        }).then(() => {
            expect(chipinApi.leaveApiGroup).toHaveBeenCalledWith({
                groupId: group.id,
                newOwnerId: 'user-2',
            });
        });
    });

test('resolves after kicking a member and refreshing backend state', () => {
        vi.mocked(chipinApi.kickApiGroupMember).mockResolvedValue(undefined);
        useActivityStore.setState({
            fetchSetActivity: vi.fn().mockResolvedValue(undefined),
        });
        useDashboardStore.setState({
            fetchSetDashboard: vi.fn().mockResolvedValue(undefined),
        });
        useGroupsStore.setState({
            fetchSetGroups: vi.fn().mockResolvedValue([group]),
        });
        useUsersStore.setState({
            fetchSetFriends: vi.fn().mockResolvedValue(undefined),
        });

        return useGroupsStore.getState().kickGroupMember({
            groupId: group.id,
        userId: 'user-2',
        }).then(result => {
            expect(result).toBeUndefined();
            expect(chipinApi.kickApiGroupMember).toHaveBeenCalledOnce();
        });
    });

    test('refetches the selected group detail after kicking a member', () => {
        const fetchSetGroupById = vi.fn().mockResolvedValue(group);
        vi.mocked(chipinApi.kickApiGroupMember).mockResolvedValue(undefined);
        useGroupsStore.setState({
            fetchSetGroupById,
        });
        useActivityStore.setState({
            fetchSetActivity: vi.fn().mockResolvedValue(undefined),
        });
        useDashboardStore.setState({
            fetchSetDashboard: vi.fn().mockResolvedValue(undefined),
        });
        useUsersStore.setState({
            fetchSetFriends: vi.fn().mockResolvedValue(undefined),
        });

        return useGroupsStore.getState().kickGroupMember({
            groupId: group.id,
            userId: 'user-2',
        }).then(() => {
            expect(fetchSetGroupById).toHaveBeenCalledWith(group.id, true);
        });
    });
});
