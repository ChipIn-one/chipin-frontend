import {
    InfiniteQueryObserver,
    MutationObserver,
    type MutationObserverOptions,
} from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiGroupsResponse, Group as WireGroup } from 'api/chipin.types';
import { usersKeys } from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { InvalidPathSegmentError } from 'shared/api/client';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { toTestGroup } from 'test/groupFixtures';
import { cachedGroupsList, groupsListData } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import type { GroupActivityData } from '../model/groupActivity';
import type { Group } from '../model/types';

import {
    createGroupMutationOptions,
    type CreateGroupParams,
    type GroupWriteEffects,
    joinGroupMutationOptions,
    kickGroupMemberMutationOptions,
    type KickGroupMemberParams,
    leaveGroupMutationOptions,
    type LeaveGroupParams,
    removeGroupMutationOptions,
    updateGroupMutationOptions,
    type UpdateGroupParams,
    uploadGroupCoverMutationOptions,
    type UploadGroupCoverParams,
} from './mutations';
import {
    groupActivityQueryOptions,
    groupDetailQueryOptions,
    groupsKeys,
    groupsListQueryOptions,
} from './queries';

const server = setupMswServer();

// The server's answers, as the test sets them: a rejection with a `response.status` answers that
// status, any other one fails the request (a network error).
const readList = vi.fn<() => Promise<ApiGroupsResponse>>();
const readGroup = vi.fn<(groupId: string) => Promise<WireGroup>>();
const readActivity = vi.fn<(groupId: string) => Promise<unknown>>();
const createWrite = vi.fn<(body: unknown) => Promise<WireGroup>>();
const updateWrite = vi.fn<(groupId: string, body: unknown) => Promise<WireGroup>>();
const coverWrite = vi.fn<(groupId: string) => Promise<WireGroup>>();
const joinWrite = vi.fn<(inviteToken: string) => Promise<WireGroup>>();
const leaveWrite = vi.fn<(groupId: string, body: unknown) => Promise<void>>();
const kickWrite = vi.fn<(groupId: string, userId: string) => Promise<void>>();
const removeWrite = vi.fn<(groupId: string) => Promise<void>>();

const statusOf = (error: unknown): number | undefined =>
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
        ? error.response.status
        : undefined;

const answer = (read: () => Promise<unknown>): Promise<Response> =>
    read().then(
        body =>
            body === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(body),
        (error: unknown) => {
            const status = statusOf(error);

            return status === undefined
                ? HttpResponse.error()
                : HttpResponse.json({ code: 'DENIED' }, { status });
        },
    );

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
} satisfies WireGroup;

const effects = {
    onGroupGone: vi.fn<GroupWriteEffects['onGroupGone']>(() => Promise.resolve()),
    onMembersChanged: vi.fn<GroupWriteEffects['onMembersChanged']>(() => Promise.resolve()),
};

let userCache: UserDashboardCache;
let stopWatchingList: () => void;
// A load of the list (as a mounted reader's refetch).
let refetchList: () => Promise<unknown>;

const run = <TData, TVariables, TContext>(
    options: MutationObserverOptions<TData, Error, TVariables, TContext>,
    variables: TVariables,
): Promise<TData> => new MutationObserver(userCache.client, options).mutate(variables);

const session = () => ({ sessionVersion: getAuthSessionVersion() });

// The writes as a hook sends them: the variables with the session they were made in.
const write = {
    create: (params: CreateGroupParams) =>
        run(createGroupMutationOptions(), { ...params, ...session() }),
    update: (params: UpdateGroupParams) =>
        run(updateGroupMutationOptions(), { ...params, ...session() }),
    cover: (params: UploadGroupCoverParams) =>
        run(uploadGroupCoverMutationOptions(), { ...params, ...session() }),
    join: (inviteToken: string) => run(joinGroupMutationOptions(), { inviteToken, ...session() }),
    leave: (params: LeaveGroupParams) =>
        run(leaveGroupMutationOptions(effects), { ...params, ...session() }),
    kick: (params: KickGroupMemberParams) =>
        run(kickGroupMemberMutationOptions(effects), { ...params, ...session() }),
    remove: (groupId: string) =>
        run(removeGroupMutationOptions(effects), { groupId, ...session() }),
};

const coverFile = () => new File(['cover'], 'cover.webp', { type: 'image/webp' });

// The tab user's cached groups list.
const listGroups = () => cachedGroupsList(userCache.client);
// The domain groups the cache holds for groups the server gave.
const cached = (groups: WireGroup[]) => groups.map(toTestGroup);

const detailOf = (groupId: string) =>
    userCache.client.getQueryData<Group>(groupsKeys.detail(groupId));
const activityOf = (groupId: string) =>
    userCache.client.getQueryData<GroupActivityData>(groupsKeys.activity(groupId));
// A group page showing `shown` (its detail read before the test).
const seedDetail = (shown: WireGroup): void => {
    userCache.client.setQueryData(groupsKeys.detail(shown.id), toTestGroup(shown), {
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
const seedList = (groups: WireGroup[]): void => {
    userCache.client.setQueryData(groupsKeys.list(), groupsListData(groups.map(toTestGroup)), {
        updatedAt: Date.now() - 1_000,
    });
};

const isKnownUsersInvalidated = () =>
    userCache.client.getQueryState(usersKeys.known())?.isInvalidated === true;

describe('group mutations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userCache = mountUserDashboardCache();
        userCache.client.setQueryData(usersKeys.known(), []);
        for (const fn of [
            readList,
            readGroup,
            readActivity,
            createWrite,
            updateWrite,
            coverWrite,
            joinWrite,
            leaveWrite,
            kickWrite,
            removeWrite,
        ]) {
            fn.mockReset();
        }
        leaveWrite.mockResolvedValue(undefined);
        kickWrite.mockResolvedValue(undefined);
        removeWrite.mockResolvedValue(undefined);
        readActivity.mockResolvedValue({ items: [], nextCursor: null });
        server.use(
            http.get('*/groups', () => answer(() => readList())),
            http.post('*/groups', ({ request }) =>
                answer(() => request.json().then(body => createWrite(body))),
            ),
            http.get('*/groups/:groupId/activity-previews', ({ params }) =>
                answer(() => readActivity(String(params.groupId))),
            ),
            http.get('*/groups/:groupId', ({ params }) =>
                answer(() => readGroup(String(params.groupId))),
            ),
            http.patch('*/groups/:groupId', ({ params, request }) =>
                answer(() =>
                    request.json().then(body => updateWrite(String(params.groupId), body)),
                ),
            ),
            http.delete('*/groups/:groupId', ({ params }) =>
                answer(() => removeWrite(String(params.groupId))),
            ),
            http.put('*/groups/:groupId/cover', ({ params }) =>
                answer(() => coverWrite(String(params.groupId))),
            ),
            http.post('*/groups/invite/:inviteToken', ({ params }) =>
                answer(() => joinWrite(String(params.inviteToken))),
            ),
            http.post('*/groups/:groupId/leave', ({ params, request }) =>
                answer(() => request.json().then(body => leaveWrite(String(params.groupId), body))),
            ),
            http.post('*/groups/:groupId/members/:userId/kick', ({ params }) =>
                answer(() => kickWrite(String(params.groupId), String(params.userId))),
            ),
        );
        seedList([]);
        // A mounted reader: invalidating the list reloads it.
        const listObserver = new InfiniteQueryObserver(userCache.client, groupsListQueryOptions());
        stopWatchingList = listObserver.subscribe(() => undefined);
        refetchList = () => listObserver.refetch();
        readList.mockResolvedValue({ items: [group], nextCursor: null });
    });

    afterEach(() => {
        stopWatchingList();
        userCache.dispose();
    });

    test('every group write is online only and never retried', () => {
        for (const options of [
            createGroupMutationOptions(),
            updateGroupMutationOptions(),
            uploadGroupCoverMutationOptions(),
            joinGroupMutationOptions(),
            leaveGroupMutationOptions(effects),
            kickGroupMemberMutationOptions(effects),
            removeGroupMutationOptions(effects),
        ]) {
            expect(options.networkMode).toBe('online');
            expect(options.retry).toBe(false);
        }
    });

    test('a created group is listed once, becomes its detail and seeds its activity: no activity request', async () => {
        const existing = { ...group, name: 'Old name' } satisfies WireGroup;
        const created = {
            ...group,
            name: 'New name',
            recentActivities: { items: [wirePreview('p1')], nextCursor: 7 },
        } satisfies WireGroup;
        seedList([existing, existing]);
        createWrite.mockResolvedValue(created);

        const result = await write.create({ groupName: created.name });

        expect(createWrite).toHaveBeenCalledWith({ name: created.name });
        expect(result).toEqual(toTestGroup(created));
        expect(listGroups()).toEqual(cached([created]));
        expect(detailOf(created.id)).toEqual(toTestGroup(created));
        await vi.waitFor(() => {
            expect(activityOf(created.id)).toEqual({
                pages: [{ items: [domainPreview('p1')], nextCursor: 7 }],
                pageParams: [null],
            });
        });
        // Opening the group: the activity reader finds its first page fresh.
        const reader = new InfiniteQueryObserver(
            userCache.client,
            groupActivityQueryOptions(created.id),
        );
        const stop = reader.subscribe(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 20));
        stop();
        expect(readActivity).not.toHaveBeenCalled();
    });

    test('a joined group seeds its activity when none is cached, as a detail read would', async () => {
        const joined = {
            ...group,
            role: 'MEMBER',
            recentActivities: { items: [wirePreview('p2')], nextCursor: null },
        } satisfies WireGroup;
        joinWrite.mockResolvedValue(joined);
        readList.mockResolvedValue({ items: [joined], nextCursor: null });

        await write.join(group.inviteToken);

        await vi.waitFor(() => {
            expect(activityOf(group.id)?.pages).toEqual([
                { items: [domainPreview('p2')], nextCursor: null },
            ]);
        });
        expect(readActivity).not.toHaveBeenCalled();
    });

    test('a create sends the description only when there is one', async () => {
        createWrite.mockResolvedValue(group);

        await write.create({ groupName: 'Trip', groupDescription: 'Berlin' });
        await write.create({ groupName: 'Trip', groupDescription: '' });

        expect(createWrite).toHaveBeenNthCalledWith(1, { name: 'Trip', description: 'Berlin' });
        expect(createWrite).toHaveBeenNthCalledWith(2, { name: 'Trip' });
    });

    test('replaces the cached list entry and detail after a cover upload', async () => {
        const updatedGroup = { ...group, coverUrl: 'https://cdn.example.com/new.webp' };
        seedList([group]);
        seedDetail(group);
        coverWrite.mockResolvedValue(updatedGroup);
        readList.mockResolvedValue({ items: [updatedGroup], nextCursor: null });

        const result = await write.cover({ groupId: group.id, file: coverFile() });

        expect(result).toEqual(toTestGroup(updatedGroup));
        expect(listGroups()).toEqual(cached([updatedGroup]));
        expect(detailOf(group.id)).toEqual(toTestGroup(updatedGroup));
    });

    test('a cover upload writes only the uploaded group, not another one shown', async () => {
        const otherGroup = { ...group, id: 'group-2', name: 'Other Group' } satisfies WireGroup;
        const updatedGroup = { ...group, updatedAt: 2 } satisfies WireGroup;
        seedList([group, otherGroup]);
        seedDetail(otherGroup);
        coverWrite.mockResolvedValue(updatedGroup);
        readList.mockResolvedValue({ items: [group, otherGroup], nextCursor: null });

        await write.cover({ groupId: group.id, file: coverFile() });

        expect(listGroups()).toEqual(cached([updatedGroup, otherGroup]));
        expect(detailOf(otherGroup.id)).toEqual(toTestGroup(otherGroup));
        expect(detailOf(group.id)).toEqual(toTestGroup(updatedGroup));
    });

    test('a failed cover upload rejects and writes nothing', async () => {
        seedList([group]);
        seedDetail(group);
        coverWrite.mockRejectedValue({ response: { status: 413 } });

        await expect(write.cover({ groupId: group.id, file: coverFile() })).rejects.toMatchObject({
            status: 413,
        });
        expect(listGroups()).toEqual(cached([group]));
        expect(detailOf(group.id)).toEqual(toTestGroup(group));
    });

    test('stores the canonical group returned after updating simplified debts', async () => {
        const updatedGroup = {
            ...group,
            updatedAt: 2,
            simplifyDebts: false,
            members: [
                ...group.members,
                {
                    user: { ...creator, id: 'user-2', displayName: 'Bob' },
                    balancesByCurrency: {
                        USD: { currency: 'USD', netBalance: -12 },
                        EUR: { currency: 'EUR', netBalance: 8 },
                    },
                },
            ],
        } satisfies WireGroup;
        seedList([group]);
        seedDetail(group);
        updateWrite.mockResolvedValue(updatedGroup);
        readList.mockResolvedValue({ items: [updatedGroup], nextCursor: null });

        const result = await write.update({ groupId: group.id, simplifyDebts: false });

        // `false` is sent, not dropped.
        expect(updateWrite).toHaveBeenCalledWith(group.id, { simplifyDebts: false });
        expect(result).toEqual(toTestGroup(updatedGroup));
        expect(listGroups()).toEqual(cached([updatedGroup]));
        expect(detailOf(group.id)).toEqual(toTestGroup(updatedGroup));
    });

    test('a failed update keeps the confirmed group', async () => {
        seedList([group]);
        seedDetail(group);
        updateWrite.mockRejectedValue({ response: { status: 400 } });

        await expect(
            write.update({ groupId: group.id, simplifyDebts: false }),
        ).rejects.toMatchObject({ status: 400 });
        expect(listGroups()).toEqual(cached([group]));
        expect(detailOf(group.id)).toEqual(toTestGroup(group));
    });

    test('a successful rejoin restores the group after a definitive detail denial', async () => {
        seedList([group]);
        seedDetail(group);
        readGroup.mockRejectedValue({ response: { status: 403 } });
        const rejoined = { ...group, role: 'MEMBER' } satisfies WireGroup;
        joinWrite.mockResolvedValue(rejoined);
        readList.mockResolvedValue({ items: [rejoined], nextCursor: null });

        await readDetail(group.id);
        await vi.waitFor(() => {
            expect(listGroups()).toEqual([]);
        });
        await write.join(group.inviteToken);

        expect(listGroups()).toEqual(cached([rejoined]));
        expect(detailOf(group.id)).toEqual(toTestGroup(rejoined));
    });

    test('resolves a successful join when the groups refresh after it fails', async () => {
        const joined = { ...group, role: 'MEMBER' } satisfies WireGroup;
        joinWrite.mockResolvedValue(joined);
        readList.mockRejectedValueOnce(new Error('list failed'));

        const result = await write.join(group.inviteToken);

        expect(result).toEqual(toTestGroup(joined));
        expect(listGroups()).toContainEqual(toTestGroup(joined));
    });

    test('ignores an old detail success after a newer canonical rejoin', async () => {
        let resolveDetail: ((result: WireGroup) => void) | undefined;
        readGroup.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER', name: 'Joined again' } satisfies WireGroup;
        joinWrite.mockResolvedValue(rejoined);
        readList.mockResolvedValue({ items: [rejoined], nextCursor: null });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        await vi.waitFor(() => {
            expect(resolveDetail).toBeDefined();
        });
        await write.join(group.inviteToken);
        resolveDetail?.({ ...group, name: 'Outdated detail' });
        await oldDetail;

        expect(listGroups()).toEqual(cached([rejoined]));
        expect(detailOf(group.id)).toEqual(toTestGroup(rejoined));
    });

    test('ignores an old detail denial after a successful rejoin of the same group', async () => {
        let rejectDetail: ((reason: unknown) => void) | undefined;
        readGroup.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectDetail = reject;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER' } satisfies WireGroup;
        joinWrite.mockResolvedValue(rejoined);
        readList.mockResolvedValue({ items: [rejoined], nextCursor: null });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        await vi.waitFor(() => {
            expect(rejectDetail).toBeDefined();
        });
        await write.join(group.inviteToken);
        rejectDetail?.({ response: { status: 404 } });
        await oldDetail;

        expect(listGroups()).toEqual(cached([rejoined]));
        expect(detailOf(group.id)).toEqual(toTestGroup(rejoined));
    });

    test('reconciles an old list with a newer group edit while retaining other groups', async () => {
        let resolveList: ((data: ApiGroupsResponse) => void) | undefined;
        const otherGroup = { ...group, id: 'other-group' } satisfies WireGroup;
        const updated = { ...group, name: 'Updated group' } satisfies WireGroup;
        readList
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        resolveList = resolve;
                    }),
            )
            .mockResolvedValueOnce({
                items: [{ ...group, name: 'Old name' }, otherGroup],
                nextCursor: null,
            });
        updateWrite.mockResolvedValue(updated);
        seedList([group]);
        seedDetail(group);

        const oldList = refetchList();
        await write.update({ groupId: group.id, groupName: updated.name });
        resolveList?.({ items: [{ ...group, name: 'Old name' }, otherGroup], nextCursor: null });
        await oldList;

        expect(detailOf(group.id)).toEqual(toTestGroup(updated));
        expect(listGroups()).toEqual(cached([updated, otherGroup]));
    });

    test('keeps an edited group while an old list request is pending', async () => {
        const otherGroup = { ...group, id: 'group-2' } satisfies WireGroup;
        const updated = { ...group, name: 'Canonical update' } satisfies WireGroup;
        readList
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({
                items: [{ ...group, name: 'Outdated list copy' }, otherGroup],
                nextCursor: null,
            });
        updateWrite.mockResolvedValue(updated);
        seedList([group, otherGroup]);

        const staleList = refetchList();
        await vi.waitFor(() => {
            expect(readList).toHaveBeenCalledOnce();
        });
        await Promise.all([
            staleList,
            write.update({ groupId: group.id, groupName: updated.name }),
        ]);

        expect(readList).toHaveBeenCalledTimes(2);
        expect(listGroups()).toEqual(cached([updated, otherGroup]));
    });

    test('keeps an uploaded cover while an old list request is pending', async () => {
        const otherGroup = { ...group, id: 'group-2' } satisfies WireGroup;
        const updated = {
            ...group,
            coverUrl: 'https://cdn.example.com/new.webp',
        } satisfies WireGroup;
        readList
            .mockImplementationOnce(() => new Promise(() => undefined))
            .mockResolvedValueOnce({ items: [group, otherGroup], nextCursor: null });
        coverWrite.mockResolvedValue(updated);
        seedList([group, otherGroup]);

        const staleList = refetchList();
        await vi.waitFor(() => {
            expect(readList).toHaveBeenCalledOnce();
        });
        await Promise.all([staleList, write.cover({ groupId: group.id, file: coverFile() })]);

        expect(readList).toHaveBeenCalledTimes(2);
        expect(listGroups()).toEqual(cached([updated, otherGroup]));
    });

    test('keeps a successful edit over an older in-flight group detail read', async () => {
        let resolveDetail: ((value: WireGroup) => void) | undefined;
        readGroup.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveDetail = resolve;
                }),
        );
        const updated = { ...group, name: 'Edited' } satisfies WireGroup;
        updateWrite.mockResolvedValue(updated);
        readList.mockResolvedValue({ items: [updated], nextCursor: null });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        await vi.waitFor(() => {
            expect(resolveDetail).toBeDefined();
        });
        await write.update({ groupId: group.id, groupName: updated.name });
        resolveDetail?.({ ...group, name: 'Old' });
        await oldDetail;

        expect(listGroups()).toEqual(cached([updated]));
        expect(detailOf(group.id)).toEqual(toTestGroup(updated));
    });

    test('ignores a late detail 404 after a successful group edit', async () => {
        let rejectDetail: ((error: unknown) => void) | undefined;
        readGroup.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectDetail = reject;
                }),
        );
        const updated = { ...group, name: 'Edited' } satisfies WireGroup;
        updateWrite.mockResolvedValue(updated);
        readList.mockResolvedValue({ items: [updated], nextCursor: null });
        seedList([group]);
        seedDetail(group);

        const oldDetail = readDetail(group.id);
        await vi.waitFor(() => {
            expect(rejectDetail).toBeDefined();
        });
        await write.update({ groupId: group.id, groupName: updated.name });
        rejectDetail?.({ response: { status: 404 } });
        await oldDetail;

        expect(listGroups()).toEqual(cached([updated]));
        expect(detailOf(group.id)).toEqual(toTestGroup(updated));
    });

    test('a joined group is listed once and becomes its detail', async () => {
        const alreadyListed = { ...group, name: 'Old name' } satisfies WireGroup;
        const joined = { ...group, role: 'MEMBER', name: 'Current name' } satisfies WireGroup;
        seedList([alreadyListed, alreadyListed]);
        joinWrite.mockResolvedValue(joined);
        readList.mockResolvedValue({ items: [joined], nextCursor: null });

        const result = await write.join(group.inviteToken);

        expect(joinWrite).toHaveBeenCalledWith(group.inviteToken);
        expect(result).toEqual(toTestGroup(joined));
        expect(listGroups()).toEqual(cached([joined]));
        expect(detailOf(group.id)).toEqual(toTestGroup(joined));
    });

    test('a create answered after the session ended writes nothing', async () => {
        let resolveCreate: ((value: WireGroup) => void) | undefined;
        createWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve;
                }),
        );

        const request = write.create({ groupName: group.name });
        await vi.waitFor(() => {
            expect(resolveCreate).toBeDefined();
        });
        invalidateAuthSession();
        resolveCreate?.(group);
        const result = await request;

        expect(result).toEqual(toTestGroup(group));
        expect(listGroups()).toEqual([]);
        expect(detailOf(group.id)).toBeUndefined();
        expect(activityOf(group.id)).toBeUndefined();
    });

    test('a join or an update answered after the session ended writes nothing', async () => {
        let resolveJoin: ((value: WireGroup) => void) | undefined;
        let resolveUpdate: ((value: WireGroup) => void) | undefined;
        joinWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveJoin = resolve;
                }),
        );
        updateWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveUpdate = resolve;
                }),
        );

        const join = write.join(group.inviteToken);
        const update = write.update({ groupId: group.id, groupName: 'Renamed' });
        await vi.waitFor(() => {
            expect(resolveJoin).toBeDefined();
            expect(resolveUpdate).toBeDefined();
        });
        invalidateAuthSession();
        resolveJoin?.(group);
        resolveUpdate?.({ ...group, name: 'Renamed' });
        await Promise.all([join, update]);

        expect(listGroups()).toEqual([]);
        expect(detailOf(group.id)).toBeUndefined();
        expect(readList).not.toHaveBeenCalled();
    });

    test('a removed group loses its detail and refetches every affected resource', async () => {
        const other = { ...group, id: 'group-2' } satisfies WireGroup;
        seedList([group, other]);
        seedDetail(group);
        seedDetail(other);
        readList.mockResolvedValue({ items: [other], nextCursor: null });

        await write.remove(group.id);

        expect(removeWrite).toHaveBeenCalledWith(group.id);
        expect(detailOf(group.id)).toBeUndefined();
        expect(detailOf(other.id)).toEqual(toTestGroup(other));
        expect(readList).toHaveBeenCalledOnce();
        expect(listGroups()).toEqual(cached([other]));
        expect(isKnownUsersInvalidated()).toBe(true);
        expect(userCache.isDashboardInvalidated()).toBe(true);
        expect(effects.onGroupGone).toHaveBeenCalledWith(group.id);
    });

    test('a failed removal keeps the group and runs no effect', async () => {
        seedDetail(group);
        removeWrite.mockRejectedValue({ response: { status: 403 } });

        await expect(write.remove(group.id)).rejects.toMatchObject({ status: 403 });
        expect(detailOf(group.id)).toEqual(toTestGroup(group));
        expect(effects.onGroupGone).not.toHaveBeenCalled();
    });

    test('a removal answered after the session ended runs no effect', async () => {
        let resolveRemove: (() => void) | undefined;
        removeWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveRemove = resolve;
                }),
        );
        seedDetail(group);

        const request = write.remove(group.id);
        await vi.waitFor(() => {
            expect(resolveRemove).toBeDefined();
        });
        invalidateAuthSession();
        resolveRemove?.();
        await request;

        expect(detailOf(group.id)).toEqual(toTestGroup(group));
        expect(effects.onGroupGone).not.toHaveBeenCalled();
        expect(userCache.isDashboardInvalidated()).toBe(false);
    });

    test('keeps a newer successful rejoin when an older leave response arrives late', async () => {
        let resolveLeave: (() => void) | undefined;
        leaveWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const rejoined = { ...group, role: 'MEMBER', name: 'Rejoined group' } satisfies WireGroup;
        joinWrite.mockResolvedValue(rejoined);
        seedDetail(group);
        readList.mockResolvedValue({ items: [rejoined], nextCursor: null });

        const leaveRequest = write.leave({ groupId: group.id });
        await vi.waitFor(() => {
            expect(resolveLeave).toBeDefined();
        });
        await write.join(group.inviteToken);
        expect(detailOf(group.id)).toEqual(toTestGroup(rejoined));
        resolveLeave?.();
        await leaveRequest;

        expect(detailOf(group.id)).toEqual(toTestGroup(rejoined));
        expect(listGroups()).toEqual(cached([rejoined]));
        expect(effects.onGroupGone).not.toHaveBeenCalled();
    });

    test('forgets group A after unrelated group B joins while leave A is pending', async () => {
        let resolveLeave: (() => void) | undefined;
        leaveWrite.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLeave = resolve;
                }),
        );
        const otherGroup = { ...group, id: 'group-2', name: 'Other group' } satisfies WireGroup;
        joinWrite.mockResolvedValue(otherGroup);
        seedDetail(group);
        readList.mockResolvedValue({ items: [otherGroup], nextCursor: null });

        const leaveRequest = write.leave({ groupId: group.id });
        await vi.waitFor(() => {
            expect(resolveLeave).toBeDefined();
        });
        await write.join(otherGroup.inviteToken);
        resolveLeave?.();
        await leaveRequest;

        expect(detailOf(group.id)).toBeUndefined();
        expect(detailOf(otherGroup.id)).toEqual(toTestGroup(otherGroup));
        expect(effects.onGroupGone).toHaveBeenCalledWith(group.id);
    });

    test('a leave sends the new owner only when there is one', async () => {
        readList.mockResolvedValue({ items: [], nextCursor: null });

        await write.leave({ groupId: group.id, newOwnerId: 'user-2' });
        await write.leave({ groupId: group.id });

        expect(leaveWrite).toHaveBeenNthCalledWith(1, group.id, { newOwnerId: 'user-2' });
        expect(leaveWrite).toHaveBeenNthCalledWith(2, group.id, {});
    });

    test.each([
        ['leave', () => write.leave({ groupId: 'a/b' })],
        ['kick group', () => write.kick({ groupId: 'a/b', userId: 'user-1' })],
        ['kick member', () => write.kick({ groupId: group.id, userId: 'a/b' })],
        ['remove', () => write.remove('a/b')],
        ['join', () => write.join('../g/members/u/kick')],
    ])('a %s with a "/" in a path parameter is refused without a request', async (_name, send) => {
        await expect(send()).rejects.toBeInstanceOf(InvalidPathSegmentError);
        for (const fn of [leaveWrite, kickWrite, removeWrite, joinWrite]) {
            expect(fn).not.toHaveBeenCalled();
        }
    });

    test('a kicked member reads the group again and refreshes what shows its members', async () => {
        seedDetail(group);
        const afterKick = { ...group, updatedAt: 3 } satisfies WireGroup;
        readGroup.mockResolvedValue(afterKick);

        const result = await write.kick({ groupId: group.id, userId: 'user-2' });

        expect(result).toBeUndefined();
        expect(kickWrite).toHaveBeenCalledWith(group.id, 'user-2');
        expect(readGroup).toHaveBeenCalledWith(group.id);
        expect(detailOf(group.id)).toEqual(toTestGroup(afterKick));
        expect(isKnownUsersInvalidated()).toBe(true);
        expect(userCache.isDashboardInvalidated()).toBe(true);
        expect(effects.onMembersChanged).toHaveBeenCalledWith(group.id);
    });
});
