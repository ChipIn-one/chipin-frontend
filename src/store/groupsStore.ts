import { create } from 'zustand';

import * as chipinApi from 'api/chipin';
import type {
    Group,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    UpdateGroupParams,
    UploadGroupCoverParams,
} from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { normalizeApiError } from 'helpers/errors';

import { useActivityStore } from './activity-store/actions';
import { useErrorsStore } from './errorsStore';
import {
    forgetGroup,
    invalidateGroup,
    invalidateGroupsList,
    putGroupDetail,
    putGroupInList,
    reloadGroupsListWith,
} from './groupsList';
import { invalidateDashboard } from './internal/dashboardQueryBridge';
import { useLoadingStore } from './loadingStore';
import { invalidateKnownUsers } from './sessionUser';
import { useUiPrefsStore } from './ui-prefs';

let groupsMutationGeneration = 0;
let successfulJoinVersions: Record<string, number> = Object.create(null) as Record<string, number>;
// The running update of each group: a second update of the same group joins it.
const activeGroupUpdates = new Map<
    string,
    {
        isCurrent: () => boolean;
        promise: Promise<Group>;
    }
>();

const createGroupsMutationGuard = () => {
    const generation = groupsMutationGeneration;
    const authSessionVersion = getAuthSessionVersion();

    return () => {
        return generation === groupsMutationGeneration && isAuthSessionCurrent(authSessionVersion);
    };
};

// The group mutations until 03-11 moves them to entities/groups; the group data itself is read
// from the `groups.list`, `groups.detail` and `groups.activity` queries (03-10a, 03-10b).
export interface GroupsStore {
    setInitialGroupsStore: () => void;
    createGroup: (params: { groupName: string; groupDescription?: string }) => Promise<Group>;
    removeGroup: (params: RemoveGroupParams) => Promise<void>;
    leaveGroup: (params: LeaveGroupParams) => Promise<void>;
    kickGroupMember: (params: KickGroupMemberParams) => Promise<void>;
    updateGroup: (params: UpdateGroupParams) => Promise<Group>;
    uploadGroupCover: (params: UploadGroupCoverParams) => Promise<Group>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<Group>;
}

// The group is gone for this user: its cached detail and activity, and the last-group default.
const refreshAfterGroupRemoval = (groupId: string): Promise<void> => {
    forgetGroup(groupId);
    const { lastGroupId, setLastGroupId } = useUiPrefsStore.getState();

    if (lastGroupId === groupId) {
        setLastGroupId(null);
    }
    return Promise.all([
        invalidateGroupsList(),
        invalidateKnownUsers(),
        invalidateDashboard(),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

const refreshAfterGroupMemberChange = (groupId: string): Promise<void> => {
    return Promise.all([
        invalidateGroup(groupId),
        invalidateKnownUsers(),
        invalidateDashboard(),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

export const useGroupsStore = create<GroupsStore>(() => ({
    setInitialGroupsStore: () => {
        groupsMutationGeneration += 1;
        successfulJoinVersions = Object.create(null) as Record<string, number>;
        activeGroupUpdates.clear();
        useErrorsStore.getState().resetErrors();
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
                    void putGroupDetail(newGroup);
                    void putGroupInList(newGroup);
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
    updateGroup: ({ groupId, groupName, groupDescription, simplifyDebts }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();

        const activeUpdate = activeGroupUpdates.get(groupId);

        if (activeUpdate?.isCurrent()) {
            return activeUpdate.promise;
        }

        clearError('group', 'update');
        setLoading('group', 'update', 'loading');

        const updatePromise = groupsApi
            .updateGroup({
                groupId,
                ...(groupName !== undefined && { groupName }),
                ...(groupDescription !== undefined && { groupDescription }),
                ...(simplifyDebts !== undefined && { simplifyDebts }),
            })
            .then(updatedGroup => {
                if (!isCurrent()) {
                    return updatedGroup;
                }
                void putGroupDetail(updatedGroup);
                return reloadGroupsListWith(updatedGroup, isCurrent).then(() => updatedGroup);
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'update', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (activeGroupUpdates.get(groupId)?.promise === updatePromise) {
                    activeGroupUpdates.delete(groupId);
                    if (isCurrent() && activeGroupUpdates.size === 0) {
                        setLoading('group', 'update', 'fetched');
                    }
                }
            });

        activeGroupUpdates.set(groupId, { isCurrent, promise: updatePromise });

        return updatePromise;
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
                if (!isCurrent()) {
                    return updatedGroup;
                }
                void putGroupDetail(updatedGroup);
                return reloadGroupsListWith(updatedGroup, isCurrent).then(() => updatedGroup);
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
                if (!isCurrent()) {
                    return;
                }

                return refreshAfterGroupRemoval(groupId);
            })
            .finally(() => {
                if (isCurrent()) {
                    setLoading('group', 'remove', 'fetched');
                }
            });
    },
    leaveGroup: ({ groupId, newOwnerId }) => {
        const joinVersionAtStart = successfulJoinVersions[groupId] ?? 0;
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
                if (!isCurrent()) {
                    return;
                }

                if ((successfulJoinVersions[groupId] ?? 0) !== joinVersionAtStart) {
                    return;
                }

                return refreshAfterGroupRemoval(groupId);
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
                return isCurrent() ? refreshAfterGroupMemberChange(groupId) : undefined;
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
                if (!isCurrent()) {
                    return joinedGroup;
                }

                successfulJoinVersions[joinedGroup.id] =
                    (successfulJoinVersions[joinedGroup.id] ?? 0) + 1;
                void putGroupDetail(joinedGroup);

                return reloadGroupsListWith(joinedGroup, isCurrent).then(() => joinedGroup);
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
