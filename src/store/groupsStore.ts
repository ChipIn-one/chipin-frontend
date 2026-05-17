import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import {
    createApiGroup,
    fetchApiUserGroupById,
    inviteApiUserToGroup,
    kickApiGroupMember,
    leaveApiGroup,
    removeApiGroup,
    updateApiGroup,
} from 'api/chipin';
import { BalanceEntry } from 'api/chipin.raw.types';
import { Group } from 'api/chipin.types';

import { useDashboardStore } from './dashboardStore';
import { calcGroupSummary } from './groupsSelectors';
import { useLoadingStore } from './loadingStore';

export interface GroupsStore {
    selectedGroup: Group | null;
    groups: Group[];
    oweEntries: BalanceEntry[];
    owedEntries: BalanceEntry[];
    netTotalInBase: number | null;
    owedTotalInBase: number | null;
    owingTotalInBase: number | null;

    setGroups: (groups: Group[]) => void;
    setSelectedGroup: (group: Group) => void;
    fetchSetGroupById: (groupId: string | undefined) => void;
    createGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<Group>;
    updateGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<Group>;
    removeGroup: () => Promise<Group['name']>;
    leaveGroup: (params?: { newOwnerId?: string }) => Promise<Group['name']>;
    kickGroupMember: ({ userId }: { userId: string }) => Promise<string>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<Group>;
}

const initialGroupsStore = {
    selectedGroup: null,
    groups: [],
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

    setGroups: groups => {
        set({ groups });
    },
    setSelectedGroup: group => {
        const { base, rates } = useDashboardStore.getState().currencies;
        set({ selectedGroup: group, ...calcGroupSummary(group.balances, base, rates) });
    },
    fetchSetGroupById: groupId => {
        const { groups } = get();

        // Fallback to join if user group is already in the store
        const existingGroup = groups.find(group => group.id === groupId);
        if (existingGroup) {
            const { base, rates } = useDashboardStore.getState().currencies;
            set({
                selectedGroup: existingGroup,
                ...calcGroupSummary(existingGroup.balances, base, rates),
            });
            return;
        }

        if (!groupId) {
            toast.error(i18n.t('toasts:group.invalidGroupId'));
            return;
        }
        useLoadingStore.getState().setLoading('group', 'data', 'loading');

        fetchApiUserGroupById(groupId)
            .then(groupFromApi => {
                if (groups.find(group => group.id === groupId)) {
                    const updatedGroups = groups.map(group =>
                        group.id === groupId ? groupFromApi : group,
                    );
                    set({ groups: updatedGroups });
                }
                const { base, rates } = useDashboardStore.getState().currencies;

                set({
                    selectedGroup: groupFromApi,
                    ...calcGroupSummary(groupFromApi.balances, base, rates),
                });
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
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
                set({
                    groups: [...groups, newGroup],
                    selectedGroup: newGroup,
                    ...calcGroupSummary(newGroup.balances, base, rates),
                });
                return newGroup;
            })
            .finally(() => {
                setLoading('group', 'add', 'fetched');
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

        const kickedMember = selectedGroup.members.find(member => member.id === userId);

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
                    members: selectedGroup.members.filter(member => member.id !== userId),
                };

                const { base, rates } = useDashboardStore.getState().currencies;
                set({
                    groups: groups.map(group =>
                        group.id === selectedGroup.id ? updatedSelectedGroup : group,
                    ),
                    selectedGroup: updatedSelectedGroup,
                    ...calcGroupSummary(updatedSelectedGroup.balances, base, rates),
                });

                return kickedMember.displayName;
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
                set({
                    groups: [...groups, joinedGroup],
                    selectedGroup: joinedGroup,
                    ...calcGroupSummary(joinedGroup.balances, base, rates),
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
}));
