import { create } from 'zustand';

import * as chipinApi from 'api/chipin';
import type {
    Group,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    UploadGroupCoverParams,
} from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { normalizeApiError } from 'helpers/errors';

import { useActivityStore } from './activity-store/actions';
import { createRequestChannel } from './internal/resourceRequests';
import { useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

const groupsChannel = createRequestChannel();
const groupDetailChannel = createRequestChannel();
let groupsMutationGeneration = 0;

const createGroupsMutationGuard = () => {
    const generation = groupsMutationGeneration;
    const authSessionVersion = getAuthSessionVersion();

    return () => {
        return (
            generation === groupsMutationGeneration &&
            isAuthSessionCurrent(authSessionVersion)
        );
    };
};

export interface GroupsStore {
    selectedGroup: Group | null;
    groups: Group[];
    groupsNextCursor: string | null;

    setInitialGroupsStore: () => void;
    setSelectedGroup: (group: Group | null) => void;
    fetchSetGroups: (force?: boolean) => Promise<Group[]>;
    fetchSetGroupById: (groupId: string, force?: boolean) => Promise<Group | null>;
    createGroup: (params: { groupName: string; groupDescription?: string }) => Promise<Group>;
    removeGroup: (params: RemoveGroupParams) => Promise<void>;
    leaveGroup: (params: LeaveGroupParams) => Promise<void>;
    kickGroupMember: (params: KickGroupMemberParams) => Promise<void>;
    updateGroup: (params: { groupName: string; groupDescription?: string }) => Promise<Group>;
    uploadGroupCover: (params: UploadGroupCoverParams) => Promise<Group>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<Group>;
}

const initialGroupsStore = {
    selectedGroup: null,
    groups: [],
    groupsNextCursor: null,
};

const refreshAfterGroupRemoval = (
    fetchSetGroups: (force?: boolean) => Promise<Group[]>,
): Promise<void> => {
    return Promise.all([
        fetchSetGroups(true),
        useUsersStore.getState().fetchSetFriends(true),
        useDashboardStore.getState().fetchSetDashboard(true),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

const refreshAfterGroupMemberChange = (
    groupId: string,
    fetchSetGroupById: GroupsStore['fetchSetGroupById'],
): Promise<void> => {
    return Promise.all([
        fetchSetGroupById(groupId, true),
        useUsersStore.getState().fetchSetFriends(true),
        useDashboardStore.getState().fetchSetDashboard(true),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

export const useGroupsStore = create<GroupsStore>((set, get) => ({
    ...initialGroupsStore,

    setInitialGroupsStore: () => {
        groupsChannel.abort();
        groupDetailChannel.abort();
        groupsMutationGeneration += 1;
        set(initialGroupsStore);
        useErrorsStore.getState().resetErrors();
    },
    setSelectedGroup: group => {
        useErrorsStore.getState().clearError('group', 'data');
        useLoadingStore.getState().setLoading('group', 'data', 'fetched');
        set({ selectedGroup: group });
    },
    fetchSetGroups: (force = false) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('group', 'list');

        const request = groupsChannel.request(chipinApi.fetchApiUserGroups, { force });
        setLoading('group', 'list', 'loading');

        return request.promise
            .then(response => {
                if (!request.isCurrent()) {
                    return get().groups;
                }

                const groups = response.items;
                const selectedGroupId = get().selectedGroup?.id;
                let selectedGroup: Group | undefined;

                if (selectedGroupId) {
                    selectedGroup = groups.find(group => group.id === selectedGroupId);
                }

                set({
                    groups,
                    groupsNextCursor: response.nextCursor,
                    ...(selectedGroupId && { selectedGroup: selectedGroup ?? null }),
                });

                return groups;
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('group', 'list', normalizeApiError(error));
                }
                return get().groups;
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('group', 'list', 'fetched');
                }
            });
    },
    fetchSetGroupById: (groupId, force = false) => {
        const { groups, selectedGroup } = get();
        const cachedGroup = selectedGroup?.id === groupId
            ? selectedGroup
            : groups.find(group => group.id === groupId);

        if (cachedGroup && !force) {
            set({ selectedGroup: cachedGroup });
            return Promise.resolve(cachedGroup);
        }

        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const request = groupDetailChannel.request(
            signal => chipinApi.fetchApiUserGroupById(groupId, signal),
            { force, identity: groupId },
        );

        clearError('group', 'data');
        setLoading('group', 'data', 'loading');

        return request.promise
            .then(group => {
                if (!request.isCurrent()) {
                    return get().selectedGroup;
                }

                set({ selectedGroup: group });
                return group;
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('group', 'data', normalizeApiError(error));
                }
                return get().selectedGroup?.id === groupId ? get().selectedGroup : null;
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('group', 'data', 'fetched');
                }
            });
    },
    createGroup: ({ groupName, groupDescription }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'add');
        setLoading('group', 'add', 'loading');

        return chipinApi
            .createApiGroup({ groupName, groupDescription })
            .then(newGroup => {
                if (isCurrent()) {
                    const { groups } = get();
                    set({
                        groups: [...groups, newGroup],
                        selectedGroup: newGroup,
                    });
                }
                return newGroup;
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'add', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'add', 'fetched');
                }
            });
    },
    updateGroup: ({ groupName, groupDescription }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const { selectedGroup } = get();
        const isCurrent = createGroupsMutationGuard();

        clearError('group', 'update');
        setLoading('group', 'update', 'loading');

        if (!selectedGroup) {
            const error = new Error('No selected group');
            setError('group', 'update', normalizeApiError(error));
            return Promise.reject(error);
        }

        return chipinApi
            .updateApiGroup({
                groupId: selectedGroup.id,
                groupName,
                groupDescription,
            })
            .then(updatedGroup => {
                if (isCurrent()) {
                    const { groups } = get();
                    set({
                        groups: groups.map(group =>
                            group.id === updatedGroup.id ? updatedGroup : group,
                        ),
                        selectedGroup: updatedGroup,
                    });
                }
                return updatedGroup;
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'update', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'update', 'fetched');
                }
            });
    },
    uploadGroupCover: params => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'cover');
        setLoading('group', 'cover', 'loading');

        return groupsApi
            .uploadGroupCover(params)
            .then(updatedGroup => {
                if (isCurrent()) {
                    set(state => ({
                        groups: state.groups.map(group =>
                            group.id === updatedGroup.id ? updatedGroup : group,
                        ),
                        selectedGroup:
                            state.selectedGroup?.id === updatedGroup.id
                                ? updatedGroup
                                : state.selectedGroup,
                    }));
                }
                return updatedGroup;
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'cover', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'cover', 'fetched');
                }
            });
    },
    removeGroup: ({ groupId }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'remove');
        setLoading('group', 'remove', 'loading');

        return chipinApi
            .removeApiGroup({ groupId })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'remove', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .then(() => {
                return isCurrent()
                    ? refreshAfterGroupRemoval(get().fetchSetGroups)
                    : undefined;
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'remove', 'fetched');
                }
            });
    },
    leaveGroup: ({ groupId, newOwnerId }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'leave');
        setLoading('group', 'leave', 'loading');

        return chipinApi
            .leaveApiGroup({ groupId, newOwnerId })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'leave', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .then(() => {
                return isCurrent()
                    ? refreshAfterGroupRemoval(get().fetchSetGroups)
                    : undefined;
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'leave', 'fetched');
                }
            });
    },
    kickGroupMember: ({ groupId, userId }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'kick');
        setLoading('group', 'kick', 'loading');

        return chipinApi
            .kickApiGroupMember({ groupId, userId })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'kick', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .then(() => {
                return isCurrent()
                    ? refreshAfterGroupMemberChange(groupId, get().fetchSetGroupById)
                    : undefined;
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'kick', 'fetched');
                }
            });
    },
    joinGroup: ({ inviteToken }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();
        clearError('group', 'join');
        setLoading('group', 'join', 'loading');
        return chipinApi
            .inviteApiUserToGroup({ inviteToken })
            .then(joinedGroup => {
                if (isCurrent()) {
                    const { groups } = get();
                    set({
                        groups: [...groups, joinedGroup],
                        selectedGroup: joinedGroup,
                    });
                }
                return joinedGroup;
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'join', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'join', 'fetched');
                }
            });
    },
}));
