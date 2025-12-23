import { toast } from 'sonner';
import { create } from 'zustand';

import { createApiGroup, fetchApiUserGroupById, removeApiGroup } from 'api/chipin';
import { ApiGroup } from 'api/chipin.types';

interface GroupsStore {
    isLoadingGroup: boolean;

    selectedGroup: ApiGroup | null;
    groups: ApiGroup[];

    setGroups: (groups: ApiGroup[]) => void;
    setSelectedGroup: (group: ApiGroup) => void;
    // fetchSetUserGroups: () => void;
    fetchSetUserGroupById: (groupId: string | undefined) => void;
    createGroup: (params: { groupName: string; groupDescription?: string }) => void;
    removeGroup: (groupId: string) => void;
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
    // fetchSetUserGroups: () => {
    //     const { selectedGroup } = get();

    //     set({ isLoadingGroups: true });
    //     fetchApiUserGroups()
    //         .then(data => {
    //             set({
    //                 groups: data,
    //                 selectedGroup: selectedGroup || data[0],
    //             });
    //         })
    //         .catch(error => {
    //             console.error('Error fetching user groups:', error);
    //         })
    //         .finally(() => {
    //             set({ isLoadingGroups: false });
    //         });
    // },
    fetchSetUserGroupById: groupId => {
        const { groups } = get();

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

    createGroup: ({ groupName, groupDescription }) => {
        createApiGroup({ groupName, groupDescription });
    },
    removeGroup: groupId => {
        removeApiGroup({ groupId });
    },
}));
