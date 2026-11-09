import { InfiniteQueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as chipinApi from 'api/chipin';
import type { Group } from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import { groupDetailQueryOptions, groupsKeys, groupsListQueryOptions } from 'entities/groups';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { useActivityStore } from './activity-store';
import { useErrorsStore } from './errorsStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { invalidateKnownUsers } from './sessionUser';
import { useUiPrefsStore } from './ui-prefs';

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

let userCache: UserDashboardCache;
let stopWatchingList: () => void;
// A load of the list (as a mounted reader's refetch).
let refetchList: () => Promise<unknown>;

// The tab user's cached groups list.
const listGroups = (): Group[] | undefined => cachedGroupsList(userCache.client);

// The tab user's cached detail of a group.
const detailOf = (groupId: string): Group | undefined =>
    userCache.client.getQueryData<Group>(groupsKeys.detail(groupId));
// A group page showing `group` (its detail read before the test).
const seedDetail = (shown: Group): void => {
    userCache.client.setQueryData(groupsKeys.detail(shown.id), shown, {
        updatedAt: Date.now() - 1_000,
    });
};
// A detail read (the group page's load); its failure or cancellation is the test's to check.
const readDetail = (groupId: string): Promise<unknown> =>
    userCache.client
        .fetchQuery({ ...groupDetailQueryOptions(groupId), staleTime: 0 })
        .catch((error: unknown) => error);

// The list as a load finished a moment before the test leaves it: fresh, no request, and older
// than any group detail the test reads.
const seedList = (groups: Group[]): void => {
    userCache.client.setQueryData(groupsKeys.list(), groupsListData(groups), {
        updatedAt: Date.now() - 1_000,
    });
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
        useUiPrefsStore.getState().resetUiPrefs();
    });

    afterEach(() => {
        stopWatchingList();
        userCache.dispose();
    });

    test('replaces the cached list entry and detail after a cover upload', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const updatedGroup = {
            ...group,
            coverUrl: 'https://cdn.example.com/group.webp',
            updatedAt: 2,
        } satisfies Group;

        seedList([group]);
        seedDetail(group);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);

        const request = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file,
        });

        expect(useLoadingStore.getState().group.cover).toBe('loading');

        return request.then(result => {
            expect(result).toEqual(updatedGroup);
            expect(listGroups()).toEqual([updatedGroup]);
            expect(detailOf(group.id)).toEqual(updatedGroup);
            expect(useLoadingStore.getState().group.cover).toBe('fetched');
        });
    });

    test('a cover upload writes only the uploaded group, not another one shown', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const otherGroup = { ...group, id: 'group-2', name: 'Other Group' } satisfies Group;
        const updatedGroup = { ...group, updatedAt: 2 } satisfies Group;

        seedList([group, otherGroup]);
        seedDetail(otherGroup);
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updatedGroup);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [group, otherGroup],
            nextCursor: null,
        });

        return useGroupsStore
            .getState()
            .uploadGroupCover({ groupId: group.id, file })
            .then(() => {
                expect(listGroups()).toEqual([updatedGroup, otherGroup]);
                expect(detailOf(otherGroup.id)).toEqual(otherGroup);
                expect(detailOf(group.id)).toEqual(updatedGroup);
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
        seedDetail(group);
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updatedGroup);

        return useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, simplifyDebts: false })
            .then(result => {
                expect(result).toBe(updatedGroup);
                expect(listGroups()).toEqual([updatedGroup]);
                expect(detailOf(group.id)).toEqual(updatedGroup);
                expect(useLoadingStore.getState().group.update).toBe('fetched');
            });
    });

    test('preserves the confirmed group and records the normalized update error', () => {
        const requestError = new Error('Update failed');
        seedList([group]);
        seedDetail(group);
        vi.mocked(groupsApi.updateGroup).mockRejectedValue(requestError);

        return expect(
            useGroupsStore.getState().updateGroup({ groupId: group.id, simplifyDebts: false }),
        )
            .rejects.toBe(requestError)
            .then(() => {
                expect(listGroups()).toEqual([group]);
                expect(detailOf(group.id)).toEqual(group);
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

        const first = useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, simplifyDebts: false });
        const duplicate = useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, simplifyDebts: true });

        expect(duplicate).toBe(first);
        expect(groupsApi.updateGroup).toHaveBeenCalledOnce();
        expect(groupsApi.updateGroup).toHaveBeenCalledWith({
            groupId: group.id,
            simplifyDebts: false,
        });

        resolveUpdate?.({ ...group, simplifyDebts: false });
        return first;
    });

    test('a successful rejoin restores the group after a definitive detail denial', () => {
        seedList([group]);
        seedDetail(group);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockRejectedValue({
            isAxiosError: true,
            response: { status: 403 },
        });
        const rejoined = { ...group, role: 'MEMBER' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [rejoined],
            nextCursor: null,
        });

        return readDetail(group.id)
            .then(() => {
                expect(listGroups()).toEqual([]);
                return useGroupsStore.getState().joinGroup({ inviteToken: group.inviteToken });
            })
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(detailOf(group.id)).toEqual(rejoined);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [rejoined],
            nextCursor: null,
        });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                resolveDetail?.({ ...group, name: 'Outdated detail' });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(detailOf(group.id)).toEqual(rejoined);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [rejoined],
            nextCursor: null,
        });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        return useGroupsStore
            .getState()
            .joinGroup({ inviteToken: group.inviteToken })
            .then(() => {
                rejectDetail?.({ isAxiosError: true, response: { status: 404 } });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([rejoined]);
                expect(detailOf(group.id)).toEqual(rejoined);
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
        seedDetail(group);

        const oldList = refetchList();
        return useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, groupName: updated.name })
            .then(() => {
                resolveList?.({
                    items: [{ ...group, name: 'Old name' }, otherGroup],
                    nextCursor: null,
                });
                return oldList;
            })
            .then(() => {
                expect(detailOf(group.id)).toEqual(updated);
                expect(listGroups()).toEqual([updated, otherGroup]);
            });
    });

    test('keeps an edited group while an old list request is pending', () => {
        const otherGroup = { ...group, id: 'group-2' } satisfies Group;
        const updated = { ...group, name: 'Canonical update' } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                items: [{ ...group, name: 'Outdated list copy' }, otherGroup],
                nextCursor: null,
            });
        vi.mocked(groupsApi.updateGroup).mockResolvedValue(updated);
        seedList([group, otherGroup]);

        const staleList = refetchList();
        const pendingUpdate = useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, groupName: updated.name });

        return Promise.all([staleList, pendingUpdate]).then(() => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
            expect(listGroups()).toEqual([updated, otherGroup]);
        });
    });

    test('keeps an uploaded cover while an old list request is pending', () => {
        const otherGroup = { ...group, id: 'group-2' } satisfies Group;
        const updated = { ...group, coverUrl: 'https://cdn.example.com/new.webp' } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                items: [group, otherGroup],
                nextCursor: null,
            });
        vi.mocked(groupsApi.uploadGroupCover).mockResolvedValue(updated);
        seedList([group, otherGroup]);

        const staleList = refetchList();
        const pendingCover = useGroupsStore.getState().uploadGroupCover({
            groupId: group.id,
            file: new File(['cover'], 'cover.webp', { type: 'image/webp' }),
        });

        return Promise.all([staleList, pendingCover]).then(() => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [updated],
            nextCursor: null,
        });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        return useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, groupName: updated.name })
            .then(() => {
                resolveDetail?.({ ...group, name: 'Old' });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([updated]);
                expect(detailOf(group.id)).toEqual(updated);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [updated],
            nextCursor: null,
        });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
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
                expect(detailOf(group.id)).toEqual(updated);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [updated],
            nextCursor: null,
        });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        return useGroupsStore
            .getState()
            .updateGroup({ groupId: group.id, groupName: updated.name })
            .then(() => {
                rejectDetail?.({ isAxiosError: true, response: { status: 404 } });
                return oldDetail;
            })
            .then(() => {
                expect(listGroups()).toEqual([updated]);
                expect(detailOf(group.id)).toEqual(updated);
            });
    });

    test('does not restore an inaccessible group from an older in-flight list response', () => {
        let resolveList: ((value: { items: Group[]; nextCursor: null }) => void) | undefined;
        const listRequest = new Promise<{ items: Group[]; nextCursor: null }>(resolve => {
            resolveList = resolve;
        });
        const otherGroup = { ...group, id: 'other-group' } satisfies Group;
        seedList([group, otherGroup]);
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
        return readDetail(group.id)
            .then(() => {
                resolveList?.({ items: [group, otherGroup], nextCursor: null });
                return pendingList;
            })
            .then(() =>
                vi.waitFor(() => {
                    // The old list was cancelled; the reload after the denial read the server.
                    expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
                    expect(listGroups()).toEqual([otherGroup]);
                }),
            )
            .then(() =>
                // A later list read decides again (the group can come back).
                refetchList().then(() => {
                    expect(listGroups()).toEqual([group, otherGroup]);
                }),
            );
    });

    test('a detail answer racing a list load reloads the list instead of trusting either', async () => {
        let resolveDetail: ((value: Group) => void) | undefined;
        let resolveFirstList: ((value: { items: Group[]; nextCursor: null }) => void) | undefined;
        const preExpense = { ...group, name: 'Before the expense' } satisfies Group;
        const postExpense = { ...group, name: 'After the expense' } satisfies Group;
        seedList([group]);
        vi.mocked(chipinApi.fetchApiUserGroupById).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        vi.mocked(chipinApi.fetchApiUserGroups)
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        resolveFirstList = resolve;
                    }),
            )
            .mockResolvedValue({ items: [postExpense], nextCursor: null });

        // A list load starts before the detail read and finishes after it was sent.
        const listLoad = refetchList();
        const detail = readDetail(group.id);
        resolveFirstList?.({ items: [preExpense], nextCursor: null });
        await listLoad;
        resolveDetail?.(postExpense);
        await detail;

        // The detail answer is not written over the list; one more list load settles it.
        await vi.waitFor(() => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledTimes(2);
            expect(listGroups()).toEqual([postExpense]);
        });
        expect(detailOf(group.id)).toEqual(postExpense);
    });

    test('a created group is listed once and becomes its detail', () => {
        const existing = { ...group, name: 'Old name' } satisfies Group;
        const created = { ...group, name: 'New name' } satisfies Group;
        seedList([existing, existing]);
        vi.mocked(chipinApi.createApiGroup).mockResolvedValue(created);

        return useGroupsStore
            .getState()
            .createGroup({ groupName: created.name })
            .then(() => {
                expect(listGroups()).toEqual([created]);
                expect(detailOf(created.id)).toEqual(created);
            });
    });

    test('a joined group is listed once and becomes its detail', () => {
        const alreadyListed = { ...group, name: 'Old name' } satisfies Group;
        const joined = { ...group, role: 'MEMBER', name: 'Current name' } satisfies Group;
        seedList([alreadyListed, alreadyListed]);
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(joined);
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [joined],
            nextCursor: null,
        });

        const request = useGroupsStore.getState().joinGroup({ inviteToken: group.inviteToken });

        expect(useLoadingStore.getState().group.join).toBe('loading');

        return request.then(result => {
            expect(result).toEqual(joined);
            expect(listGroups()).toEqual([joined]);
            expect(detailOf(group.id)).toEqual(joined);
            expect(useLoadingStore.getState().group.join).toBe('fetched');
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
                expect(detailOf(group.id)).toBeUndefined();
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

    test('a removed group loses its detail and the last-group default, another group keeps them', () => {
        const other = { ...group, id: 'group-2' } satisfies Group;
        seedDetail(group);
        seedDetail(other);
        useUiPrefsStore.getState().setLastGroupId(group.id);
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                expect(detailOf(group.id)).toBeUndefined();
                expect(detailOf(other.id)).toEqual(other);
                expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
            });
    });

    test('removing an unrelated group keeps the last-group default', () => {
        useUiPrefsStore.getState().setLastGroupId('group-2');
        vi.mocked(chipinApi.removeApiGroup).mockResolvedValue(undefined);
        useActivityStore.setState({ fetchSetActivity: vi.fn().mockResolvedValue(undefined) });

        return useGroupsStore
            .getState()
            .removeGroup({ groupId: group.id })
            .then(() => {
                expect(useUiPrefsStore.getState().lastGroupId).toBe('group-2');
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

    test('keeps a newer successful rejoin when an older leave response arrives late', () => {
        let resolveLeave: (() => void) | undefined;
        vi.mocked(chipinApi.leaveApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER', name: 'Rejoined group' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(rejoined);
        seedDetail(group);
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
                expect(detailOf(group.id)).toEqual(rejoined);
                resolveLeave?.();
                return leaveRequest;
            })
            .then(() => {
                expect(detailOf(group.id)).toEqual(rejoined);
                expect(listGroups()).toEqual([rejoined]);
            });
    });

    test('forgets group A after unrelated group B joins while leave A is pending', () => {
        let resolveLeave: (() => void) | undefined;
        vi.mocked(chipinApi.leaveApiGroup).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const otherGroup = { ...group, id: 'group-2', name: 'Other group' } satisfies Group;
        vi.mocked(chipinApi.inviteApiUserToGroup).mockResolvedValue(otherGroup);
        seedDetail(group);
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
                resolveLeave?.();
                return leaveRequest;
            })
            .then(() => {
                expect(detailOf(group.id)).toBeUndefined();
                expect(detailOf(otherGroup.id)).toEqual(otherGroup);
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

    test('marks the group detail stale after kicking a member', () => {
        seedDetail(group);
        vi.mocked(chipinApi.kickApiGroupMember).mockResolvedValue(undefined);
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
            .then(result => {
                expect(result).toBeUndefined();
                expect(chipinApi.kickApiGroupMember).toHaveBeenCalledOnce();
                expect(
                    userCache.client.getQueryState(groupsKeys.detail(group.id))?.isInvalidated,
                ).toBe(true);
                expect(invalidateKnownUsers).toHaveBeenCalledOnce();
            });
    });
});
