import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as chipinApi from 'api/chipin';
import type { Group, User } from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import * as ledgerApi from 'api/ledgerApi';

import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

vi.mock('api/chipin', () => ({
    fetchApiUserGroupById: vi.fn(),
    fetchApiUserGroups: vi.fn(),
    inviteApiUserToGroup: vi.fn(),
}));

vi.mock('api/ledgerApi', () => ({
    createSettlement: vi.fn(),
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
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const currentUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
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

    test('keeps same-currency debts in both summary directions', () => {
        const mixedDirectionGroup: Group = {
            ...group,
            name: 'Vietnam',
            members: [
                { user: creator, balancesByCurrency: {} },
                {
                    user: { ...creator, id: 'user-2' },
                    balancesByCurrency: {
                        USD: { currency: 'USD', netBalance: 20 },
                    },
                },
                {
                    user: { ...creator, id: 'user-3' },
                    balancesByCurrency: {
                        USD: { currency: 'USD', netBalance: -20 },
                    },
                },
            ],
        };

        useGroupsStore.getState().setSelectedGroup(mixedDirectionGroup);

        expect(useGroupsStore.getState()).toMatchObject({
            owedEntries: [{ currency: 'USD', netBalance: 20 }],
            oweEntries: [{ currency: 'USD', netBalance: -20 }],
            netTotalInBase: 0,
            owedTotalInBase: 20,
            owingTotalInBase: 20,
        });
    });

    test('creates a scoped partial settlement and updates selected and cached group balances', () => {
        vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
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
            expect(ledgerApi.createSettlement).toHaveBeenCalledWith({
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
        vi.mocked(ledgerApi.createSettlement).mockResolvedValue({} as never);
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
        vi.mocked(ledgerApi.createSettlement).mockRejectedValue(requestError);
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
                    expect(ledgerApi.createSettlement).toHaveBeenCalledWith({
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
                    expect(ledgerApi.createSettlement).not.toHaveBeenCalled();
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
                    expect(ledgerApi.createSettlement).not.toHaveBeenCalled();
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
                    expect(ledgerApi.createSettlement).not.toHaveBeenCalled();
                },
            );
    });

    test('keeps group balances unchanged when settlement creation fails', () => {
        const requestError = new Error('Settlement failed');
        vi.mocked(ledgerApi.createSettlement).mockRejectedValue(requestError);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: expectedGroups,
            nextCursor: 2,
        });

        const request = useGroupsStore.getState().fetchSetGroups();

        expect(useLoadingStore.getState().group.list).toBe('loading');

        return request.then(fetchedGroups => {
            expect(chipinApi.fetchApiUserGroups).toHaveBeenCalledOnce();
            expect(fetchedGroups).toEqual(expectedGroups);
            expect(useGroupsStore.getState().groups).toEqual(expectedGroups);
            expect(useGroupsStore.getState().groupsNextCursor).toBe(2);
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
            ...settlementGroup,
            name: 'Updated group',
        };

        useGroupsStore.getState().setSelectedGroup(settlementGroup);
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

    test('uses the same group response for fetch by id', () => {
        const groupWithActivityCursor = {
            ...group,
            recentActivities: {
                items: [],
                nextCursor: 73,
            },
        } satisfies Group;
        vi.mocked(chipinApi.fetchApiUserGroupById).mockResolvedValue(groupWithActivityCursor);

        return useGroupsStore
            .getState()
            .fetchSetGroupById(group.id)
            .then(fetchedGroup => {
                expect(fetchedGroup).toEqual(groupWithActivityCursor);
                expect(useGroupsStore.getState().selectedGroup).toEqual(groupWithActivityCursor);
                expect(
                    useGroupsStore.getState().selectedGroup?.recentActivities.nextCursor,
                ).toBe(73);
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
        vi.mocked(chipinApi.fetchApiUserGroups).mockResolvedValue({
            items: [group, otherGroup],
            nextCursor: null,
        });

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
