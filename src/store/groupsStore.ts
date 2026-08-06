import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import {
    createApiGroup,
    fetchApiUserGroupById,
    fetchApiUserGroups,
    inviteApiUserToGroup,
    kickApiGroupMember,
    leaveApiGroup,
    removeApiGroup,
    updateApiGroup,
} from 'api/chipin';
import type { BalanceEntry } from 'api/chipin.raw.types';
import type { CreateSettlementParams, Group } from 'api/chipin.types';
import * as ledgerApi from 'api/ledgerApi';

import { useDashboardStore } from './dashboardStore';
import { calcGroupSummary, selectGroupBalances } from './groupsSelectors';
import { useLoadingStore } from './loadingStore';
import { selectUserCurrency } from './users-store';
import { useUsersStore } from './users-store';

export interface GroupsStore {
    selectedGroup: Group | null;
    groups: Group[];
    groupsNextCursor: number | null;
    oweEntries: BalanceEntry[];
    owedEntries: BalanceEntry[];
    netTotalInBase: number | null;
    owedTotalInBase: number | null;
    owingTotalInBase: number | null;

    setInitialGroupsStore: () => void;
    setSelectedGroup: (group: Group) => void;
    fetchSetGroups: () => Promise<Group[]>;
    fetchSetGroupById: (groupId: string | undefined) => Promise<Group | void>;
    createGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<Group>;
    createSettlement: (params: Omit<CreateSettlementParams, 'groupId'>) => Promise<void>;
    updateGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<Group>;
    removeGroup: () => Promise<Group['name']>;
    leaveGroup: (params?: { newOwnerId?: string }) => Promise<Group['name']>;
    kickGroupMember: ({ userId }: { userId: string }) => Promise<string>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<Group>;
    setSelectedGroupSummaryCurrency: (defaultCurrency: string) => void;
}

const initialGroupsStore = {
    selectedGroup: null,
    groups: [],
    groupsNextCursor: null,
    oweEntries: [],
    owedEntries: [],
    netTotalInBase: null,
    owedTotalInBase: null,
    owingTotalInBase: null,
};

const GROUP_SUMMARY_RESET = {
    owedEntries: [] as BalanceEntry[],
    oweEntries: [] as BalanceEntry[],
    netTotalInBase: null as number | null,
    owedTotalInBase: null as number | null,
    owingTotalInBase: null as number | null,
};

export const useGroupsStore = create<GroupsStore>((set, get) => ({
    ...initialGroupsStore,

    setInitialGroupsStore: () => {
        set(initialGroupsStore);
    },
    setSelectedGroup: group => {
        const { base, rates } = useDashboardStore.getState().currencies;
        const defaultCurrency = selectUserCurrency(useUsersStore.getState());
        set({
            selectedGroup: group,
            ...calcGroupSummary(
                selectGroupBalances(group),
                base,
                rates,
                defaultCurrency,
            ),
        });
    },
    fetchSetGroups: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'list', 'loading');

        return fetchApiUserGroups()
            .then(response => {
                const groups = response.items;
                const selectedGroupId = get().selectedGroup?.id;
                let selectedGroup: Group | undefined;

                if (selectedGroupId) {
                    selectedGroup = groups.find(
                        group => group.id === selectedGroupId,
                    );
                }

                set({ groups, groupsNextCursor: response.nextCursor });

                if (selectedGroup) {
                    get().setSelectedGroup(selectedGroup);
                }

                return groups;
            })
            .catch((error: unknown) => {
                console.error('Error fetching user groups:', error);
                return Promise.reject(error);
            })
            .finally(() => {
                setLoading('group', 'list', 'fetched');
            });
    },
    fetchSetGroupById: groupId => {
        if (!groupId) {
            toast.error(i18n.t('toasts:group.invalidGroupId'));
            return Promise.resolve();
        }

        const selectedGroup = get().selectedGroup;
        if (selectedGroup?.id === groupId) {
            return Promise.resolve(selectedGroup);
        }

        const cachedGroup = get().groups.find(group => group.id === groupId);
        if (cachedGroup) {
            get().setSelectedGroup(cachedGroup);
            return Promise.resolve(cachedGroup);
        }

        useLoadingStore.getState().setLoading('group', 'data', 'loading');

        return fetchApiUserGroupById(groupId)
            .then(groupFromApi => {
                get().setSelectedGroup(groupFromApi);
                return groupFromApi;
            })
            .catch((error: unknown) => {
                console.error('Error fetching user groups:', error);
                return Promise.reject(error);
            })
            .finally(() => {
                useLoadingStore.getState().setLoading('group', 'data', 'fetched');
            });
    },
    createGroup: ({ groupName, groupDescription, groupEmoji }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'add', 'loading');

        return createApiGroup({ groupName, groupDescription, groupEmoji })
            .then(newGroup => {
                const { groups } = get();
                const { base, rates } = useDashboardStore.getState().currencies;
                const defaultCurrency = selectUserCurrency(useUsersStore.getState());
                set({
                    groups: [...groups, newGroup],
                    selectedGroup: newGroup,
                    ...calcGroupSummary(
                        selectGroupBalances(newGroup),
                        base,
                        rates,
                        defaultCurrency,
                    ),
                });
                return newGroup;
            })
            .finally(() => {
                setLoading('group', 'add', 'fetched');
            });
    },
    createSettlement: params => {
        const selectedGroup = get().selectedGroup;

        if (!selectedGroup) {
            return Promise.reject(new Error('Group settlement context is unavailable'));
        }

        const currentUserId = useUsersStore.getState().user?.id;
        const memberId = params.fromUserId === currentUserId ? params.toUserId : params.fromUserId;
        const member = selectedGroup.members.find(groupMember => groupMember.user.id === memberId);

        if (!member) {
            return Promise.reject(new Error('Group settlement participant is unavailable'));
        }

        const balance = member.balancesByCurrency[params.currency];

        if (!balance) {
            return Promise.reject(new Error('Group settlement balance is unavailable'));
        }

        const { setLoading } = useLoadingStore.getState();
        const request = { ...params, groupId: selectedGroup.id } satisfies CreateSettlementParams;
        setLoading('settlement', 'add', 'loading');

        return ledgerApi
            .createSettlement(request)
            .then(() => {
                set(state => {
                    const currentGroup = state.selectedGroup;

                    if (!currentGroup || currentGroup.id !== selectedGroup.id) {
                        return {};
                    }

                    const updatedGroup: Group = {
                        ...currentGroup,
                        members: currentGroup.members.map(groupMember => {
                            if (groupMember.user.id !== memberId) {
                                return groupMember;
                            }

                            const currentBalance = groupMember.balancesByCurrency[params.currency];

                            if (!currentBalance) {
                                return groupMember;
                            }

                            const nextBalances =
                                params.amount === Math.abs(currentBalance.netBalance)
                                    ? Object.fromEntries(
                                          Object.entries(groupMember.balancesByCurrency).filter(
                                              ([currency]) => currency !== params.currency,
                                          ),
                                      )
                                    : {
                                          ...groupMember.balancesByCurrency,
                                          [params.currency]: {
                                              ...currentBalance,
                                              netBalance:
                                                  currentBalance.netBalance +
                                                  (currentBalance.netBalance < 0
                                                      ? params.amount
                                                      : -params.amount),
                                          },
                                      };

                            return { ...groupMember, balancesByCurrency: nextBalances };
                        }),
                    };
                    const { base, rates } = useDashboardStore.getState().currencies;
                    const defaultCurrency = selectUserCurrency(useUsersStore.getState());

                    return {
                        groups: state.groups.map(group =>
                            group.id === updatedGroup.id ? updatedGroup : group,
                        ),
                        selectedGroup: updatedGroup,
                        ...calcGroupSummary(
                            selectGroupBalances(updatedGroup),
                            base,
                            rates,
                            defaultCurrency,
                        ),
                    };
                });
            })
            .finally(() => {
                setLoading('settlement', 'add', 'fetched');
            });
    },
    updateGroup: ({ groupName, groupDescription, groupEmoji }) => {
        const { setLoading } = useLoadingStore.getState();
        const { selectedGroup } = get();

        setLoading('group', 'update', 'loading');

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        return updateApiGroup({
            groupId: selectedGroup.id,
            groupName,
            groupDescription,
            groupEmoji,
        })
            .then(updatedGroup => {
                const { groups } = get();
                set({
                    groups: groups.map(group =>
                        group.id === updatedGroup.id ? updatedGroup : group,
                    ),
                    selectedGroup: updatedGroup,
                });
                return updatedGroup;
            })
            .finally(() => {
                setLoading('group', 'update', 'fetched');
            });
    },
    removeGroup: () => {
        const selectedGroup = get().selectedGroup;

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'remove', 'loading');

        return removeApiGroup({ groupId: selectedGroup.id })
            .then(() => {
                const { groups } = get();
                const updatedGroups = groups.filter(group => group.id !== selectedGroup.id);

                set({
                    groups: updatedGroups,
                    selectedGroup: null,
                    ...GROUP_SUMMARY_RESET,
                });

                return selectedGroup.name;
            })
            .finally(() => {
                setLoading('group', 'remove', 'fetched');
            });
    },
    leaveGroup: params => {
        const selectedGroup = get().selectedGroup;

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'leave', 'loading');

        return leaveApiGroup({ groupId: selectedGroup.id, newOwnerId: params?.newOwnerId })
            .then(() => {
                const { groups } = get();
                const updatedGroups = groups.filter(group => group.id !== selectedGroup.id);

                set({
                    groups: updatedGroups,
                    selectedGroup: null,
                    ...GROUP_SUMMARY_RESET,
                });

                return selectedGroup.name;
            })
            .finally(() => {
                setLoading('group', 'leave', 'fetched');
            });
    },
    kickGroupMember: ({ userId }) => {
        const selectedGroup = get().selectedGroup;

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        const kickedMember = selectedGroup.members.find(member => member.user.id === userId);

        if (!kickedMember) {
            return Promise.reject(new Error('No member found to kick'));
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'kick', 'loading');

        return kickApiGroupMember({ groupId: selectedGroup.id, userId })
            .then(() => {
                const { groups } = get();
                const updatedSelectedGroup: Group = {
                    ...selectedGroup,
                    members: selectedGroup.members.filter(member => member.user.id !== userId),
                };

                const { base, rates } = useDashboardStore.getState().currencies;
                const defaultCurrency = selectUserCurrency(useUsersStore.getState());
                set({
                    groups: groups.map(group =>
                        group.id === selectedGroup.id ? updatedSelectedGroup : group,
                    ),
                    selectedGroup: updatedSelectedGroup,
                    ...calcGroupSummary(
                        selectGroupBalances(updatedSelectedGroup),
                        base,
                        rates,
                        defaultCurrency,
                    ),
                });

                return kickedMember.user.displayName;
            })
            .finally(() => {
                setLoading('group', 'kick', 'fetched');
            });
    },
    joinGroup: ({ inviteToken }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'join', 'loading');
        return inviteApiUserToGroup({ inviteToken })
            .then(joinedGroup => {
                const { groups } = get();
                const { base, rates } = useDashboardStore.getState().currencies;
                const defaultCurrency = selectUserCurrency(useUsersStore.getState());
                set({
                    groups: [...groups, joinedGroup],
                    selectedGroup: joinedGroup,
                    ...calcGroupSummary(
                        selectGroupBalances(joinedGroup),
                        base,
                        rates,
                        defaultCurrency,
                    ),
                });
                return joinedGroup;
            })
            .catch(e => {
                console.error(e);
                throw e;
            })
            .finally(() => {
                setLoading('group', 'join', 'fetched');
            });
    },
    setSelectedGroupSummaryCurrency: defaultCurrency => {
        set(state => {
            if (!state.selectedGroup) {
                return {};
            }

            const { base, rates } = useDashboardStore.getState().currencies;

            return calcGroupSummary(
                selectGroupBalances(state.selectedGroup),
                base,
                rates,
                defaultCurrency,
            );
        });
    },
}));
