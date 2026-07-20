import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as chipinApi from 'api/chipin';
import type { Group, User } from 'api/chipin.types';

import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './usersStore';

vi.mock('api/chipin', () => ({
    createApiSettlement: vi.fn(),
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

const currentUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
    },
} satisfies User;

const settlementGroup: Group = {
    ...group,
    members: [
        { user: creator, balancesByCurrency: {} },
        {
            user: { ...creator, id: 'user-2', displayName: 'Bob' },
            balancesByCurrency: {
                USD: { currency: 'USD', netBalance: -100 },
                EUR: { currency: 'EUR', netBalance: 25 },
            },
        },
    ],
};

describe('groupsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGroupsStore.getState().setInitialGroupsStore();
        useLoadingStore.getState().setInitialLoadingStore();
        useUsersStore.setState({ user: currentUser });
    });

    test('creates a scoped partial settlement and updates selected and cached group balances', () => {
        vi.mocked(chipinApi.createApiSettlement).mockResolvedValue({} as never);
        useGroupsStore.setState({ groups: [settlementGroup] });
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        const request = useGroupsStore.getState().createSettlement({
            fromUserId: currentUser.id,
            toUserId: 'user-2',
            amount: 40,
            currency: 'USD',
        });

        expect(useLoadingStore.getState().settlement.add).toBe('loading');

        return request.then(() => {
            expect(chipinApi.createApiSettlement).toHaveBeenCalledWith({
                groupId: settlementGroup.id,
                fromUserId: currentUser.id,
                toUserId: 'user-2',
                amount: 40,
                currency: 'USD',
            });
            expect(
                useGroupsStore.getState().selectedGroup?.members[1].balancesByCurrency.USD,
            ).toEqual({ currency: 'USD', netBalance: -60 });
            expect(useGroupsStore.getState().groups[0].members[1].balancesByCurrency.USD).toEqual({
                currency: 'USD',
                netBalance: -60,
            });
            expect(useLoadingStore.getState().settlement.add).toBe('fetched');
        });
    });

    test('removes a fully settled group currency balance', () => {
        vi.mocked(chipinApi.createApiSettlement).mockResolvedValue({} as never);
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: 'user-2',
                toUserId: currentUser.id,
                amount: 25,
                currency: 'EUR',
            })
            .then(() => {
                expect(
                    useGroupsStore.getState().selectedGroup?.members[1].balancesByCurrency.EUR,
                ).toBeUndefined();
            });
    });

    test('forwards amount validation to the settlement API', () => {
        const requestError = new Error('Amount exceeds balance');
        vi.mocked(chipinApi.createApiSettlement).mockRejectedValue(requestError);
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: currentUser.id,
                toUserId: 'user-2',
                amount: 100.01,
                currency: 'USD',
            })
            .then(
                () => Promise.reject(new Error('Expected settlement to reject')),
                error => {
                    expect(error).toBe(requestError);
                    expect(chipinApi.createApiSettlement).toHaveBeenCalledWith({
                        groupId: settlementGroup.id,
                        fromUserId: currentUser.id,
                        toUserId: 'user-2',
                        amount: 100.01,
                        currency: 'USD',
                    });
                    expect(useLoadingStore.getState().settlement.add).toBe('fetched');
                },
            );
    });

    test('rejects settlement when no group is selected', () => {
        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: currentUser.id,
                toUserId: 'user-2',
                amount: 10,
                currency: 'USD',
            })
            .then(
                () => Promise.reject(new Error('Expected settlement to reject')),
                error => {
                    expect(error).toEqual(new Error('Group settlement context is unavailable'));
                    expect(chipinApi.createApiSettlement).not.toHaveBeenCalled();
                },
            );
    });

    test('rejects settlement when the participant is not in the selected group', () => {
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: currentUser.id,
                toUserId: 'missing-user',
                amount: 10,
                currency: 'USD',
            })
            .then(
                () => Promise.reject(new Error('Expected settlement to reject')),
                error => {
                    expect(error).toEqual(new Error('Group settlement participant is unavailable'));
                    expect(chipinApi.createApiSettlement).not.toHaveBeenCalled();
                },
            );
    });

    test('rejects settlement when the participant has no balance in the currency', () => {
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: currentUser.id,
                toUserId: 'user-2',
                amount: 10,
                currency: 'BZD',
            })
            .then(
                () => Promise.reject(new Error('Expected settlement to reject')),
                error => {
                    expect(error).toEqual(new Error('Group settlement balance is unavailable'));
                    expect(chipinApi.createApiSettlement).not.toHaveBeenCalled();
                },
            );
    });

    test('keeps group balances unchanged when settlement creation fails', () => {
        const requestError = new Error('Settlement failed');
        vi.mocked(chipinApi.createApiSettlement).mockRejectedValue(requestError);
        useGroupsStore.getState().setSelectedGroup(settlementGroup);

        return useGroupsStore
            .getState()
            .createSettlement({
                fromUserId: currentUser.id,
                toUserId: 'user-2',
                amount: 40,
                currency: 'USD',
            })
            .then(
                () => Promise.reject(new Error('Expected settlement to reject')),
                error => {
                    expect(error).toBe(requestError);
                    expect(
                        useGroupsStore.getState().selectedGroup?.members[1].balancesByCurrency.USD,
                    ).toEqual({ currency: 'USD', netBalance: -100 });
                    expect(useLoadingStore.getState().settlement.add).toBe('fetched');
                },
            );
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
