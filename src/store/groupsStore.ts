import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import {
    createApiGroup,
    fetchApiUserGroupById,
    inviteApiUserToGroup,
    removeApiGroup,
    updateApiGroup,
} from 'api/chipin';
import { ApiGroup } from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';

interface GroupsStore {
    selectedGroup: ApiGroup | null;
    groups: ApiGroup[];

    setGroups: (groups: ApiGroup[]) => void;
    setSelectedGroup: (group: ApiGroup) => void;
    fetchSetGroupById: (groupId: string | undefined) => void;
    createGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<ApiGroup>;
    updateGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<ApiGroup>;
    removeGroup: () => Promise<ApiGroup['name']>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<ApiGroup>;
}

const initialGroupsStore = {
    selectedGroup: null,
    groups: [],
};

export const useGroupsStore = create<GroupsStore>((set, get) => ({
    ...initialGroupsStore,

    setGroups: groups => {
        set({ groups });
    },
    setSelectedGroup: group => {
        set({ selectedGroup: group });
    },
    fetchSetGroupById: groupId => {
        const { groups } = get();

        // Fallback to join if user group is already in the store
        if (groups.find(group => group.id === groupId)) {
            const selectedGroup = groups.find(group => group.id === groupId) || null;
            set({ selectedGroup });
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
                set({ selectedGroup: groupFromApi });
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
                set({ groups: [...groups, newGroup], selectedGroup: newGroup });
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
                });

                return selectedGroup.name;
            })
            .finally(() => {
                setLoading('group', 'remove', 'fetched');
            });
    },
    joinGroup: ({ inviteToken }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'join', 'loading');

        return inviteApiUserToGroup({ inviteToken })
            .then(joinedGroup => {
                const { groups } = get();
                set({ groups: [...groups, joinedGroup], selectedGroup: joinedGroup });
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
