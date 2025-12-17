import { toast } from 'sonner';
import { ApiGroup } from 'types/api';
import { create } from 'zustand';

import { createApiGroup, fetchApiUserGroups, inviteApiUserToGroup } from 'api/chipin';
import { MESSAGES } from 'constants/messages';

import { useAuthStore } from './authStore';

interface GroupStore {
    isLoadingGroups: boolean;

    selectedGroup: ApiGroup | null;
    groups: ApiGroup[];

    setSelectedGroup: (group: ApiGroup) => void;
    fetchSetUserGroups: () => void;
    createGroup: (params: { groupName: string; groupDescription?: string }) => void;
    inviteToGroup: (params: { inviteToken: ApiGroup['inviteToken'] }) => void;
}

const initialAuthStore = {
    isLoadingGroups: false,
    selectedGroup: null,
    groups: [],
};

export const useGroupStore = create<GroupStore>((set, get) => ({
    ...initialAuthStore,

    setSelectedGroup: group => {
        set({ selectedGroup: group });
    },
    fetchSetUserGroups: () => {
        const { selectedGroup } = get();

        set({ isLoadingGroups: true });
        fetchApiUserGroups()
            .then(data => {
                set({
                    groups: data,
                    selectedGroup: selectedGroup || data[0],
                });
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
            })
            .finally(() => {
                set({ isLoadingGroups: false });
            });
    },
    createGroup: ({ groupName, groupDescription }) => {
        createApiGroup({ groupName, groupDescription });
    },

    inviteToGroup: ({ inviteToken }) => {
        const { isLoggedIn } = useAuthStore.getState();

        inviteApiUserToGroup({ inviteToken })
            .then(data => {
                console.log(data);
                toast.success(MESSAGES.success.group.INVITE_JOIN);
            })
            .catch(error => {
                console.error('Error fetching user groups:', error);
                if (isLoggedIn) {
                    toast.error(MESSAGES.error.group.INVITE_JOIN);
                } else {
                    toast.warning(MESSAGES.warning.group.INVITE_JOIN);
                }
            });
    },
}));
