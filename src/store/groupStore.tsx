import { toast } from 'sonner';
import { ApiGroup } from 'types/api';
import { create } from 'zustand';

import { createApiGroup, fetchApiUserGroups, inviteApiUserToGroup } from 'api/chipin';
import { MESSAGES } from 'constants/messages';

interface GroupStore {
    selectedGroup: ApiGroup | null;
    groups: ApiGroup[];

    setSelectedGroup: (group: ApiGroup) => void;
    fetchSetUserGroups: () => void;
    createGroup: (params: { groupName: string; groupDescription?: string }) => void;
    inviteToGroup: (params: { inviteToken: ApiGroup['inviteToken'] }) => void;
}

const initialAuthStore = {
    selectedGroup: null,
    groups: [],
};

export const useGroupStore = create<GroupStore>(set => ({
    ...initialAuthStore,

    setSelectedGroup: group => {
        set({ selectedGroup: group });
    },
    fetchSetUserGroups: () => {
        fetchApiUserGroups()
            .then(data => {
                set({ groups: data, selectedGroup: data[0] || initialAuthStore.selectedGroup });
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
            });
    },
    createGroup: ({ groupName, groupDescription }) => {
        createApiGroup({ groupName, groupDescription });
    },

    inviteToGroup: ({ inviteToken }) => {
        inviteApiUserToGroup({ inviteToken })
            .then(data => {
                console.log(data);
                toast.success(MESSAGES.success.group.INVITE_SUCCESS);
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
                toast.error(MESSAGES.error.group.INVITE_SUCCESS);
            });
    },
}));
