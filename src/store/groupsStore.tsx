import { toast } from 'sonner';
import { create } from 'zustand';

import {
    createApiGroup,
    fetchApiUserGroupById,
    inviteApiUserToGroup,
    removeApiGroup,
} from 'api/chipin';
import { ApiGroup, JoinGroupResponse } from 'api/chipin.types';

interface GroupsStore {
    isLoadingGroup: boolean;
    isJoiningGroup: boolean;
    isCreatingGroup: boolean;

    selectedGroup: ApiGroup | null;
    groups: ApiGroup[];

    setGroups: (groups: ApiGroup[]) => void;
    setSelectedGroup: (group: ApiGroup) => void;
    // fetchSetUserGroups: () => void;
    fetchSetUserGroupById: (groupId: string | undefined) => void;
    createGroup: (params: {
        groupName: string;
        groupDescription?: string;
        groupEmoji?: string;
    }) => Promise<ApiGroup>;
    removeGroup: (groupId: string) => void;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<JoinGroupResponse>;
}

const initialGroupsStore = {
    isCreatingGroup: false,
    isLoadingGroup: false,
    isJoiningGroup: false,
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

    createGroup: ({ groupName, groupDescription, groupEmoji }) => {
        set({ isCreatingGroup: true });

        return createApiGroup({ groupName, groupDescription, groupEmoji })
            .then(newGroup => {
                const { groups } = get();
                set({ groups: [...groups, newGroup], selectedGroup: newGroup });
                return newGroup;
            })
            .finally(() => {
                set({ isCreatingGroup: false });
            });
    },
    removeGroup: groupId => {
        removeApiGroup({ groupId });
    },
    joinGroup: ({ inviteToken }) => {
        set({ isJoiningGroup: true });

        return inviteApiUserToGroup({ inviteToken })
            .catch(e => {
                console.error(e);
                throw e;
            })
            .finally(() => {
                set({ isJoiningGroup: false });
            });
    },
}));
