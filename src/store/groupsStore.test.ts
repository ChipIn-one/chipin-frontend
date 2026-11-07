import { InfiniteQueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as activityApi from 'api/activityApi';
import * as chipinApi from 'api/chipin';
import type { ActivityFeedItem, Group } from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { groupsKeys, groupsListQueryOptions } from 'entities/groups';
import { getActivityPreviewEvents } from 'helpers/activityEvent';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { useActivityStore } from './activity-store';
import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { invalidateKnownUsers } from './sessionUser';

vi.mock('./sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('./sessionUser')>()),
    invalidateKnownUsers: vi.fn(() => Promise.resolve()),
}));

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
    updateGroup: vi.fn(),
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
    lastEvent: {
        id: `event-${parentId}`,
        seq: 1,
        action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    } as ActivityFeedItem['lastEvent'],
});

const createGroupWithActivity = (items: ActivityFeedItem[], nextCursor: number | null): Group => ({
    ...group,
    recentActivities: { items, nextCursor },
});

let userCache: UserDashboardCache;
let stopWatchingList: () => void;
// A load of the list (as a mounted reader's refetch).
let refetchList: () => Promise<unknown>;

// The tab user's cached groups list.
const listGroups = (): Group[] | undefined => cachedGroupsList(userCache.client);

// The list as a finished load leaves it: fresh, no request.
const seedList = (groups: Group[]): void => {
    userCache.client.setQueryData(groupsKeys.list(), groupsListData(groups));
};

describe('groupsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userCache = mountUserDashboardCache();
        seedList([]);
        // A mounted reader: invalidating the list reloads it.
        const listObserver = new InfiniteQueryObserver(userCache.client, groupsListQueryOptions());
        stopWatchingList = listObserver.subscribe(() => undefined);
        refetchList = () => listObserver.refetch();
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockReset()
            .mockResolvedValue({
                items: [group],
                nextCursor: null,
            });
        useErrorsStore.getState().resetErrors();
        useGroupsStore.getState().setInitialGroupsStore();
        useLoadingStore.getState().setInitialLoadingStore();
    });

    afterEach(() => {
        stopWatchingList();
        userCache.dispose();
    });

    test('replaces the matching cached and selected group after a cover upload', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const updatedGroup = {
            ...group,
            coverUrl: 'https://cdn.example.com/group.webp',
            updatedAt: 2,
        } satisfies Group;

        seedList([group]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);

        const request = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file,
        });

        expect(useLoadingStore.getState().group.cover).toBe('loading');

        return request.then(result => {
            expect(result).toEqual(updatedGroup);
            expect(listGroups()).toEqual([updatedGroup]);
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

        seedList([group, otherGroup]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);

        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [group, otherGroup],
            nextCursor: null,
        });

        const request = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file,
        });

        useGroupsStore.getState().setSelectedGroup(otherGroup);

        return request.then(() => {
            expect(listGroups()).toEqual([updatedGroup, otherGroup]);
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

    test('stores the canonical group returned after updating simplified debts', () => {
        const updatedGroup = {
            ...group,
            updatedAt: 2,
            simplifyDebts: false,
            members: [
                ...group.members,
                {
                    user: {
                        ...creator,
                        id: 'user-2',
                        displayName: 'Bob',
                    },
                    balancesByCurrency: {
                        USD: { currency: 'USD', netBalance: -12 },
                        EUR: { currency: 'EUR', netBalance: 8 },
                    },
                },
            ],
        } satisfies Group;
        seedList([group]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updatedGroup);

        return useGroupsStore
            .getState()
            .updateGroup({ simplifyDebts: false })
            .then(result => {
                expect(result).toBe(updatedGroup);
                expect(listGroups()).toEqual([updatedGroup]);
                expect(useGroupsStore.getState().selectedGroup).toBe(updatedGroup);
                expect(useLoadingStore.getState().group.update).toBe('fetched');
            });
    });

    test('rejects without a selected group before entering update loading', () => {
        const request = useGroupsStore.getState().updateGroup({ simplifyDebts: false });

        return expect(request)
            .rejects.toThrow('No selected group')
            .then(() => {
                expect(groupsApi.updateGroup).not.toHaveBeenCalled();
                expect(useLoadingStore.getState().group.update).not.toBe('loading');
                expect(useErrorsStore.getState().errors.group.update).toEqual(
                    expect.objectContaining({ message: expect.any(String) }),
                );
            });
    });

    test('preserves the confirmed group and records the normalized update error', () => {
        const requestError = new Error('Update failed');
        seedList([group]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.updateGroup).mockRejectedValue(requestError);

        return expect(useGroupsStore.getState().updateGroup({ simplifyDebts: false }))
            .rejects.toBe(requestError)
            .then(() => {
                expect(listGroups()).toEqual([group]);
                expect(useGroupsStore.getState().selectedGroup).toBe(group);
                expect(useErrorsStore.getState().errors.group.update).toEqual(
                    expect.objectContaining({ message: expect.any(String) }),
                );
                expect(useLoadingStore.getState().group.update).toBe('fetched');
            });
    });

    test('reuses one pending update request and preserves false in the API input', () => {
        let resolveUpdate: ((value: Group) => void) | undefined;
        const request = new Promise<Group>(resolve => {
            resolveUpdate = resolve;
        });
        vi.mocked(groupsApi.updateGroup).mockReturnValue(request);
        useGroupsStore.getState().setSelectedGroup(group);

        const first = useGroupsStore.getState().updateGroup({ simplifyDebts: false });
        const duplicate = useGroupsStore.getState().updateGroup({ simplifyDebts: true });

        expect(duplicate).toBe(first);
        expect(groupsApi.updateGroup).toHaveBeenCalledOnce();
        expect(groupsApi.updateGroup).toHaveBeenCalledWith({
            groupId: group.id,
            simplifyDebts: false,
        });

        resolveUpdate?.({ ...group, simplifyDebts: false });
        return first;
    });

    test('does not replace a newer selected group after an update resolves', () => {
        let resolveUpdate: ((value: Group) => void) | undefined;
        const request = new Promise<Group>(resolve => {
            resolveUpdate = resolve;
        });
        const otherGroup = { ...group, id: 'group-2', name: 'Other Group' } satisfies Group;
        const updatedGroup = { ...group, simplifyDebts: false, updatedAt: 2 } satisfies Group;
        seedList([group, otherGroup]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(groupsApi.updateGroup).mockReturnValue(request);

        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [group, otherGroup],
            nextCursor: null,
        });

        const updateRequest = useGroupsStore.getState().updateGroup({ simplifyDebts: false });
        useGroupsStore.getState().setSelectedGroup(otherGroup);
        resolveUpdate?.(updatedGroup);

        return updateRequest.then(() => {
            expect(listGroups()).toEqual([updatedGroup, otherGroup]);
            expect(useGroupsStore.getState().selectedGroup).toBe(otherGroup);
        });
    });

    test.each([403, 404])('evicts an inaccessible group from the list on detail %i', status => {
        const otherGroup = { ...group, id: 'other-group' } satisfies Group;
        const denied = {
            isAxiosError: true,
            response: { status, data: { code: 'GROUP_NOT_FOUND' } },
        };
        seedList([group, otherGroup]);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockRejectedValue(denied);

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id, true)
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
                expect(listGroups()).toEqual([otherGroup]);
                expect(useErrorsStore.getState().errors.group.data).not.toBeNull();
            });
    });

    test('ignores a stale detail denial after switching to another group', () => {
        let rejectDetail: ((error: unknown) => void) | undefined;
        const otherGroup = { ...group, id: 'other-group' } satisfies Group;
        seedList([group, otherGroup]);
        useGroupsStore.setState({ selectedGroup: group });
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectDetail = reject;
                }),
        );

        const pending = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        useGroupsStore.getState().setSelectedGroup(otherGroup);
        rejectDetail?.({ isAxiosError: true, response: { status: 404 } });

        return pending.then(() => {
            expect(useGroupsStore.getState().selectedGroup).toBe(otherGroup);
            expect(listGroups()).toEqual([group, otherGroup]);
            expect(useErrorsStore.getState().errors.group.data).toBeNull();
        });
    });

    test('does not restore an inaccessible group from an older in-flight list response', () => {
        let resolveList: ((value: { items: Group[]; nextCursor: null }) => void) | undefined;
        const listRequest = new Promise<{ items: Group[]; nextCursor: null }>(resolve => {
            resolveList = resolve;
        });
        const otherGroup = { ...group, id: 'other-group' } satisfies Group;
        seedList([group, otherGroup]);
        useGroupsStore.setState({ selectedGroup: group });
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(() => listRequest)
            // The server no longer lists the group the detail denied.
            .mockResolvedValueOnce({ items: [otherGroup], nextCursor: null })
            .mockResolvedValue({ items: [group, otherGroup], nextCursor: null });
        vi.mocked(chipinApi.fetchApiUserGroupById).mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        });

        const pendingList = refetchList();
        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id, true)
            .then(() => {
                resolveList?.({ items: [group, otherGroup], nextCursor: null });
                return pendingList;
            })
            .then(() => {
                // The old list was cancelled; the reload after the denial read the server.
                expect(listGroups()).toEqual([otherGroup]);
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
                expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);

                // A later list read decides again (the group can come back).
                return refetchList().then(() => {
                    expect(listGroups()).toEqual([group, otherGroup]);
                });
            });
    });

    test('a successful rejoin restores the group after a definitive detail denial', () => {
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });
        vi.mocked(chipinApi.fetchApiUserGroupById).mockRejectedValue({
            isAxiosError: true,
            response: { status: 403 },
        });
        const rejoined = { ...group, role: 'MEMBER' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id, true)
            .then(() => useGroupsStore.getState().joinGroup({ inviteToken: group.inviteToken }))
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(useGroupsStore.getState().selectedGroup).toBe(rejoined);
            });
    });

    test('resolves a successful join when the groups refresh after it fails', () => {
        const joined = { ...group, role: 'MEMBER' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(joined);
        vi.mocked(chipinApi.fetchApiUserGroups).mockRejectedValueOnce(new Error('list failed'));

        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(result => {
                expect(result).toBe(joined);
                expect(listGroups()).toContainEqual(joined);
            });
    });

    test('ignores an old detail success after a newer canonical rejoin', () => {
        let resolveDetail: ((result: Group) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER', name: 'Joined again' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldDetail = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                resolveDetail?.({ ...group, name: 'Outdated detail' });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(useGroupsStore.getState().selectedGroup).toBe(rejoined);
            });
    });

    test('ignores an old detail denial after a successful rejoin of the same group', () => {
        let rejectDetail: ((reason: unknown) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectDetail = reject;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldDetail = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                rejectDetail?.({ isAxiosError: true, response: { status: 404 } });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(useGroupsStore.getState().selectedGroup).toBe(rejoined);
            });
    });

    test('reconciles an old list with a newer group edit while retaining other groups', () => {
        let resolveList: ((data: { items: Group[]; nextCursor: null }) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroups).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveList = resolve;
                }),
        );
        const otherGroup = { ...group, id: 'other-group' } satisfies Group;
        const updated = { ...group, name: 'Updated group' } satisfies Group;
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updated);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValueOnce({
            items: [{ ...group, name: 'Old name' }, otherGroup],
            nextCursor: null,
        });
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldList = refetchList();
        return useGroupsStore
            .getState()
            .updateGroup({ groupName: updated.name })
            .then(() => {
                resolveList?.({
                    items: [{ ...group, name: 'Old name' }, otherGroup],
                    nextCursor: null,
                });
                return oldList;
            })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(updated);
                expect(listGroups()).toEqual([updated, otherGroup]);
            });
    });

    test('keeps an edited group after navigating away while an old list request is pending', () => {
        let resolveUpdate: ((value: Group) => void) | undefined;
        const otherGroup = { ...group, id: 'group-2' } satisfies Group;
        const updated = { ...group, name: 'Canonical update' } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                items: [{ ...group, name: 'Outdated list copy' }, otherGroup],
                nextCursor: null,
            });
        vi.mocked(groupsApi.updateGroup).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveUpdate = resolve;
                }),
        );
        seedList([group, otherGroup]);
        useGroupsStore.setState({ selectedGroup: group });

        const staleList = refetchList();
        const pendingUpdate = useGroupsStore.getState().updateGroup({ groupName: updated.name });
        useGroupsStore.getState().setSelectedGroup(otherGroup);
        resolveUpdate?.(updated);

        return Promise.all([staleList, pendingUpdate]).then(() => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
            expect(useGroupsStore.getState().selectedGroup).toBe(otherGroup);
            expect(listGroups()).toEqual([updated, otherGroup]);
        });
    });

    test('keeps an uploaded cover after navigating away while a list request is pending', () => {
        let resolveCover: ((value: Group) => void) | undefined;
        const otherGroup = { ...group, id: 'group-2' } satisfies Group;
        const updated = { ...group, coverUrl: 'https://cdn.example.com/new.webp' } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                items: [group, otherGroup],
                nextCursor: null,
            });
        vi.mocked(groupsApi.uploadGroupCover).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveCover = resolve;
                }),
        );
        seedList([group, otherGroup]);
        useGroupsStore.setState({ selectedGroup: group });

        const staleList = refetchList();
        const pendingCover = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file: new File(['cover'], 'cover.webp', { type: 'image/webp' }),
        });
        useGroupsStore.getState().setSelectedGroup(otherGroup);
        resolveCover?.(updated);

        return Promise.all([staleList, pendingCover]).then(() => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
            expect(useGroupsStore.getState().selectedGroup).toBe(otherGroup);
            expect(listGroups()).toEqual([updated, otherGroup]);
        });
    });

    test('keeps a successful edit over an older in-flight group detail GET', () => {
        let resolveDetail: ((group: Group) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        const updated = { ...group, name: 'Edited' } satisfies Group;
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updated);
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldDetail = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        return useGroupsStore
            .getState()
            .updateGroup({ groupName: updated.name })
            .then(() => {
                resolveDetail?.({ ...group, name: 'Old' });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([updated]);
                expect(useGroupsStore.getState().selectedGroup).toBe(updated);
                expect(useLoadingStore.getState().group.data).toBe('fetched');
            });
    });

    test('keeps a successful cover upload over an older in-flight group detail GET', () => {
        let resolveDetail: ((group: Group) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        const updated = {
            ...group,
            coverUrl: 'https://cdn.example.com/edited.webp',
        } satisfies Group;
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updated);
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldDetail = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        return useGroupsStore
            .getState()
            .uploadGroupCover({
                groupId: group.id,
                file: new File(['cover'], 'cover.webp', { type: 'image/webp' }),
            })
            .then(() => {
                resolveDetail?.(group);
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([updated]);
                expect(useGroupsStore.getState().selectedGroup).toBe(updated);
            });
    });

    test('ignores a late detail 404 after successful group edit', () => {
        let rejectDetail: ((error: unknown) => void) | undefined;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectDetail = reject;
                }),
        );
        const updated = { ...group, name: 'Edited' } satisfies Group;
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updated);
        seedList([group]);
        useGroupsStore.setState({ selectedGroup: group });

        const oldDetail = useGroupsStore.getState().fetchSetGroupById(group.id, true);
        return useGroupsStore
            .getState()
            .updateGroup({ groupName: updated.name })
            .then(() => {
                rejectDetail?.({ isAxiosError: true, response: { status: 404 } });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([updated]);
                expect(useGroupsStore.getState().selectedGroup).toBe(updated);
                expect(useErrorsStore.getState().errors.group.data).toBeNull();
            });
    });

    test('preserves last-confirmed group on transient detail failure', () => {
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockRejectedValue(
            new Error('Temporary failure'),
        );

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id, true)
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(group);
            });
    });

    test('fetches a canonical group by id when it is outside the loaded list', () => {
        vi.mocked(chipinApi.fetchApiUserGroupById).mockResolvedValue(group);
        seedList([]);
        useGroupsStore.setState({ selectedGroup: null });

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id)
            .then(result => {
                expect(result).toEqual(group);
                expect(useGroupsStore.getState().selectedGroup).toEqual(group);
            });
    });

    test('ignores a late forced detail response after selecting another cached group', () => {
        let resolveRequest: ((value: Group) => void) | undefined;
        let requestSignal: AbortSignal | undefined;
        const firstGroup = { ...group };
        const secondGroup = { ...group, id: 'group-2', name: 'Other Group' };
        seedList([firstGroup, secondGroup]);
        useGroupsStore.getState().setSelectedGroup(firstGroup);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce((_groupId, signal) => {
            requestSignal = signal;
            return new Promise(resolve => {
                resolveRequest = resolve;
            });
        });

        const request = useGroupsStore.getState().fetchSetGroupById(firstGroup.id, true);
        useGroupsStore.getState().setSelectedGroup(secondGroup);
        resolveRequest?.(firstGroup);

        return request.then(() => {
            expect(requestSignal?.aborted).toBe(true);
            expect(useGroupsStore.getState().selectedGroup).toBe(secondGroup);
        });
    });

    test('ACT-023 continues the selected group activity feed from its embedded cursor', () => {
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

    test('ACT-021 deduplicates group activity previews by parent id in API order', () => {
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

        return useGroupsStore
            .getState()
            .fetchMoreGroupActivity()
            .then(() => {
                expect(
                    useGroupsStore
                        .getState()
                        .selectedGroup?.recentActivities.items.map(item => item.parent.id),
                ).toEqual(['parent-1', 'parent-2', 'parent-3', 'parent-4']);
                expect(useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor).toBe(
                    40,
                );
            });
    });

    test('ACT-021 uses the highest-sequence edited preview from a later overlapping group page', () => {
        const first = createActivityItem('parent-1');
        const second = createActivityItem('parent-2');
        const newer = {
            parent: first.parent,
            lastEvent: {
                ...first.lastEvent,
                id: 'newest-edit',
                seq: 3,
                action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
            } as ActivityFeedItem['lastEvent'],
        } satisfies ActivityFeedItem;
        useGroupsStore.getState().setSelectedGroup(createGroupWithActivity([first, second], 20));
        vi.mocked(activityApi.fetchGroupActivityPreviews).mockResolvedValue({
            items: [newer],
            nextCursor: null,
        });

        return useGroupsStore
            .getState()
            .fetchMoreGroupActivity()
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual([
                    newer,
                    second,
                ]);
                expect(
                    useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor,
                ).toBeNull();
            });
    });

    test('ACT-022 keeps a later group reversal as a tombstone across older overlapping pages', () => {
        const active = createActivityItem('parent-1');
        const unaffected = createActivityItem('parent-2');
        const reversed = {
            parent: active.parent,
            lastEvent: {
                ...active.lastEvent,
                id: 'reversed-child',
                seq: 5,
                action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
            } as ActivityFeedItem['lastEvent'],
        } satisfies ActivityFeedItem;
        useGroupsStore
            .getState()
            .setSelectedGroup(createGroupWithActivity([active, unaffected], 20));
        vi.mocked(activityApi.fetchGroupActivityPreviews)
            .mockResolvedValueOnce({ items: [reversed], nextCursor: 40 })
            .mockResolvedValueOnce({ items: [active], nextCursor: null });

        return useGroupsStore
            .getState()
            .fetchMoreGroupActivity()
            .then(() => {
                const firstPage = useGroupsStore.getState().selectedGroup?.recentActivities;
                expect(firstPage?.items).toEqual([reversed, unaffected]);
                expect(firstPage?.nextCursor).toBe(40);
                expect(getActivityPreviewEvents(firstPage?.items ?? [])).toEqual([unaffected]);
                return useGroupsStore.getState().fetchMoreGroupActivity();
            })
            .then(() => {
                const finalPage = useGroupsStore.getState().selectedGroup?.recentActivities;
                expect(finalPage?.items).toEqual([reversed, unaffected]);
                expect(finalPage?.nextCursor).toBeNull();
                expect(getActivityPreviewEvents(finalPage?.items ?? [])).toEqual([unaffected]);
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

        return useGroupsStore
            .getState()
            .fetchMoreGroupActivity()
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup?.recentActivities.items).toEqual(
                    initialItems,
                );
                expect(useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor).toBe(
                    20,
                );
                expect(useLoadingStore.getState().group.nextPage).toBe('fetched');
                expect(useErrorsStore.getState().errors.group.nextPage?.message).toBe(
                    requestError.message,
                );

                return useGroupsStore.getState().fetchMoreGroupActivity();
            })
            .then(() => {
                expect(activityApi.fetchGroupActivityPreviews).toHaveBeenLastCalledWith(
                    { groupId: group.id, limit: 20, cursor: 20 },
                    expect.any(AbortSignal),
                );
                expect(useErrorsStore.getState().errors.group.nextPage).toBeNull();
            });
    });

    test('ignores a late group activity success after switching groups', () => {
        let resolveRequest:
            ((value: { items: ActivityFeedItem[]; nextCursor: null }) => void) | undefined;
        const pendingRequest = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>(
            resolve => {
                resolveRequest = resolve;
            },
        );
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
        const pendingRequest = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>(
            (_, reject) => {
                rejectRequest = reject;
            },
        );
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
        let resolveActivity:
            ((value: { items: ActivityFeedItem[]; nextCursor: null }) => void) | undefined;
        let resolveGroup: ((value: Group) => void) | undefined;
        const pendingActivity = new Promise<{ items: ActivityFeedItem[]; nextCursor: null }>(
            resolve => {
                resolveActivity = resolve;
            },
        );
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
            expect(listGroups()).toEqual([joinedGroup]);
            expect(useGroupsStore.getState().selectedGroup).toEqual(joinedGroup);
            expect(useLoadingStore.getState().group.join).toBe('fetched');
        });
    });

    test('upserts an already-listed joined group by ID instead of duplicating it', () => {
        const alreadyListed = { ...group, name: 'Old name' } satisfies Group;
        const joined = { ...group, role: 'MEMBER', name: 'Current name' } satisfies Group;
        seedList([alreadyListed, alreadyListed]);
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(joined);

        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                expect(listGroups()).toEqual([joined]);
                expect(useGroupsStore.getState().selectedGroup).toBe(joined);
            });
    });

    test('upserts created group without duplicate list IDs', () => {
        const existing = { ...group, name: 'Old name' } satisfies Group;
        const created = { ...group, name: 'New name' } satisfies Group;
        seedList([existing, existing]);
        vi.mocked(chipinApi.createApiGroup).mockResolvedValue(created);

        return useGroupsStore
            .getState()
            .createGroup({ groupName: created.name })
            .then(() => {
                expect(listGroups()).toEqual([created]);
                expect(useGroupsStore.getState().selectedGroup).toBe(created);
            });
    });

    test('does not restore group state when create resolves after reset', () => {
        let resolveCreate: ((value: Group) => void) | undefined;
        vi.mocked(chipinApi.createApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve;
                }),
        );

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
                expect(listGroups()).toEqual([]);
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
                expect(useLoadingStore.getState().group.add).toBe('initial');
            });
    });

    test('does not restore group errors when join rejects after reset', () => {
        let rejectJoin: ((reason?: unknown) => void) | undefined;
        const joinError = new Error('stale join failed');
        vi.mocked(chipinApi.inviteApiUserToGroup).mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectJoin = reject;
                }),
        );

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

    test('clears the affected selected group on successful removal even when list refresh fails', () => {
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
            });
    });

    test('does not clear another group when removing an unrelated one', () => {
        const current = { ...group, id: 'group-2' } satisfies Group;
        useGroupsStore.getState().setSelectedGroup(current);
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(current);
            });
    });

    test('removes a group and refetches every affected backend resource', () => {
        const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
        seedList([group]);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({ items: [], nextCursor: null });
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity });
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledOnce();
                expect(listGroups()).toEqual([]);
                expect(invalidateKnownUsers).toHaveBeenCalledOnce();
                expect(userCache.isDashboardInvalidated()).toBe(true);
                expect(fetchSetActivity).toHaveBeenCalledWith(true);
            });
    });

    test('keeps a newer successful rejoin selected when an older leave response arrives late', () => {
        let resolveLeave: (() => void) | undefined;
        vi.mocked(chipinApi.leaveApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER', name: 'Rejoined group' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [rejoined],
            nextCursor: null,
        });
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        const leaveRequest = useGroupsStore.getState().leaveGroup({ groupId: group.id });

        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(rejoined);
                resolveLeave?.();
                return leaveRequest;
            })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(rejoined);
                expect(listGroups()).toEqual([rejoined]);
            });
    });

    test('clears group A after unrelated group B joins while leave A is pending', () => {
        let resolveLeave: (() => void) | undefined;
        vi.mocked(chipinApi.leaveApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const otherGroup = { ...group, id: 'group-2', name: 'Other group' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(otherGroup);
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [otherGroup],
            nextCursor: null,
        });
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        const leaveRequest = useGroupsStore.getState().leaveGroup({ groupId: group.id });

        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: otherGroup.inviteToken })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBe(otherGroup);
                useGroupsStore.getState().setSelectedGroup(group);
                resolveLeave?.();
                return leaveRequest;
            })
            .then(() => {
                expect(useGroupsStore.getState().selectedGroup).toBeNull();
            });
    });

    test('still invalidates a successfully left group after an intervening detail refresh', () => {
        let resolveLeave: (() => void) | undefined;
        vi.mocked(chipinApi.leaveApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const refreshed = { ...group, name: 'New detail snapshot' } satisfies Group;
        useGroupsStore.getState().setSelectedGroup(group);
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        const leaveRequest = useGroupsStore.getState().leaveGroup({ groupId: group.id });
        useGroupsStore.getState().setSelectedGroup(refreshed);
        resolveLeave?.();

        return leaveRequest.then(() => {
            expect(useGroupsStore.getState().selectedGroup).toBeNull();
        });
    });

    test('leaves a group before refetching backend state', () => {
        vi.mocked(chipinApi.leaveApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({
            fetchSetActivity: vi.fn().mockResolvedValue(undefined),
        });
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [],
            nextCursor: null,
        });
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

        return useGroupsStore
            .getState()
            .leaveGroup({
                groupId: group.id,
                newOwnerId: 'user-2',
            })
            .then(() => {
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [group],
            nextCursor: null,
        });
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

        return useGroupsStore
            .getState()
            .kickGroupMember({
                groupId: group.id,
                userId: 'user-2',
            })
            .then(result => {
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
        vi.mocked(invalidateKnownUsers).mockResolvedValue(undefined);

        return useGroupsStore
            .getState()
            .kickGroupMember({
                groupId: group.id,
                userId: 'user-2',
            })
            .then(() => {
                expect(fetchSetGroupById).toHaveBeenCalledWith(group.id, true);
            });
    });
});
