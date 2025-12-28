import { toast } from 'sonner';
import { create } from 'zustand';

import {
    createApiGroup,
    fetchApiUserGroupById,
    inviteApiUserToGroup,
    removeApiGroup,
} from 'api/chipin';
import { ApiGroup } from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';

interface GroupsStore {
    isLoadingGroup: boolean;

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
    removeGroup: () => Promise<ApiGroup['name']>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<ApiGroup>;
}

const initialGroupsStore = {
    isLoadingGroup: false,
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
            toast.error('Invalid group ID for fetching group');
            return;
        }
        set({ isLoadingGroup: true });

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
                set({ isLoadingGroup: false });
            });
    },

    createGroup: ({ groupName, groupDescription, groupEmoji }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'add', true);

        return createApiGroup({ groupName, groupDescription, groupEmoji })
            .then(newGroup => {
                const { groups } = get();
                set({ groups: [...groups, newGroup], selectedGroup: newGroup });
                return newGroup;
            })
            .finally(() => {
                setLoading('group', 'add', false);
            });
    },
    removeGroup: () => {
        const selectedGroup = get().selectedGroup;

        if (!selectedGroup) {
            return Promise.reject(new Error('No selected group'));
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'remove', true);

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
                setLoading('group', 'remove', false);
            });
    },
    joinGroup: ({ inviteToken }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('group', 'join', true);

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
                setLoading('group', 'join', false);
            });
    },
}));
