import { create } from 'zustand';

import * as activityApi from 'api/activityApi';
import * as chipinApi from 'api/chipin';
import type {
    ActivityFeedItem,
    Group,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    UpdateGroupParams,
    UploadGroupCoverParams,
} from 'api/chipin.types';
import * as groupsApi from 'api/groupsApi';
import { ACTIVITY_API_LIMIT } from 'constants/activity';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { getApiErrorStatus, normalizeApiError } from 'helpers/errors';

import { useActivityStore } from './activity-store/actions';
import { useErrorsStore } from './errorsStore';
import {
    dropGroupFromList,
    invalidateGroupsList,
    putGroupInList,
    reloadGroupsListWith,
} from './groupsList';
import { invalidateDashboard } from './internal/dashboardQueryBridge';
import { createRequestChannel } from './internal/resourceRequests';
import { useLoadingStore } from './loadingStore';
import { invalidateKnownUsers } from './sessionUser';

const groupDetailChannel = createRequestChannel();
const groupActivityPageChannel = createRequestChannel();
let groupsMutationGeneration = 0;
let successfulJoinVersions: Record<string, number> = Object.create(null) as Record<string, number>;
let activeGroupUpdate:
    | {
          groupId: string;
          isCurrent: () => boolean;
          promise: Promise<Group>;
      }
    | undefined;

const resetGroupActivityPagination = (): void => {
    groupActivityPageChannel.abort();
    useLoadingStore.getState().setLoading('group', 'nextPage', 'fetched');
    useErrorsStore.getState().clearError('group', 'nextPage');
};

const appendUniqueActivityPreviews = (
    confirmedItems: ActivityFeedItem[],
    incomingItems: ActivityFeedItem[],
): ActivityFeedItem[] => {
    const uniqueItems: ActivityFeedItem[] = [];
    const parentIndexes = new Map<string, number>();
    const confirmedItemCount = confirmedItems.length;
    const totalItemCount = confirmedItemCount + incomingItems.length;

    for (let index = 0; index < totalItemCount; index += 1) {
        const item =
            index < confirmedItemCount
                ? confirmedItems[index]
                : incomingItems[index - confirmedItemCount];
        if (item === undefined) {
            continue;
        }
        const parentId = item.parent.id;
        const existingIndex = parentIndexes.get(parentId);

        if (existingIndex !== undefined) {
            const existingItem = uniqueItems[existingIndex];
            // Keep a newer edit or reversal, including reversals needed as tombstones.
            if (existingItem === undefined || item.lastEvent.seq > existingItem.lastEvent.seq) {
                uniqueItems[existingIndex] = item;
            }
            continue;
        }

        parentIndexes.set(parentId, uniqueItems.length);
        uniqueItems.push(item);
    }

    return uniqueItems;
};

const createGroupsMutationGuard = () => {
    const generation = groupsMutationGeneration;
    const authSessionVersion = getAuthSessionVersion();

    return () => {
        return generation === groupsMutationGeneration && isAuthSessionCurrent(authSessionVersion);
    };
};

export interface GroupsStore {
    selectedGroup: Group | null;

    setInitialGroupsStore: () => void;
    setSelectedGroup: (group: Group | null) => void;
    fetchSetGroupById: (groupId: string, force?: boolean) => Promise<Group | null>;
    fetchMoreGroupActivity: () => Promise<void>;
    createGroup: (params: { groupName: string; groupDescription?: string }) => Promise<Group>;
    removeGroup: (params: RemoveGroupParams) => Promise<void>;
    leaveGroup: (params: LeaveGroupParams) => Promise<void>;
    kickGroupMember: (params: KickGroupMemberParams) => Promise<void>;
    updateGroup: (params: Omit<UpdateGroupParams, 'groupId'>) => Promise<Group>;
    uploadGroupCover: (params: UploadGroupCoverParams) => Promise<Group>;
    joinGroup: ({ inviteToken }: { inviteToken: string }) => Promise<Group>;
}

const initialGroupsStore = {
    selectedGroup: null,
};

const refreshAfterGroupRemoval = (): Promise<void> => {
    return Promise.all([
        invalidateGroupsList(),
        invalidateKnownUsers(),
        invalidateDashboard(),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

const refreshAfterGroupMemberChange = (
    groupId: string,
    fetchSetGroupById: GroupsStore['fetchSetGroupById'],
): Promise<void> => {
    return Promise.all([
        fetchSetGroupById(groupId, true),
        invalidateKnownUsers(),
        invalidateDashboard(),
        useActivityStore.getState().fetchSetActivity(true),
    ]).then(() => undefined);
};

export const useGroupsStore = create<GroupsStore>((set, get) => ({
    ...initialGroupsStore,

    setInitialGroupsStore: () => {
        groupDetailChannel.abort();
        resetGroupActivityPagination();
        groupsMutationGeneration += 1;
        successfulJoinVersions = Object.create(null) as Record<string, number>;
        activeGroupUpdate = undefined;
        set(initialGroupsStore);
        useErrorsStore.getState().resetErrors();
    },
    setSelectedGroup: group => {
        if (get().selectedGroup?.id !== group?.id) {
            groupDetailChannel.abort();
            resetGroupActivityPagination();
        }
        useErrorsStore.getState().clearError('group', 'data');
        useLoadingStore.getState().setLoading('group', 'data', 'fetched');
        set({ selectedGroup: group });
    },
    fetchSetGroupById: (groupId, force = false) => {
        const { selectedGroup } = get();

        if (force || selectedGroup?.id !== groupId) {
            resetGroupActivityPagination();
        }

        if (selectedGroup && selectedGroup.id !== groupId) {
            set({ selectedGroup: null });
        }

        // Every caller forces a read today; without `force` only the selected group is reused (the
        // list is not a detail cache: its entries may be older than the page needs).
        if (selectedGroup?.id === groupId && !force) {
            return Promise.resolve(selectedGroup);
        }

        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        // A list loaded after this read was sent is newer than its answer (see `putGroupInList`).
        const readStartedAt = Date.now();
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
                void putGroupInList(group, readStartedAt);
                return group;
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('group', 'data', normalizeApiError(error));
                    const status = getApiErrorStatus(error);

                    if (status === 403 || status === 404) {
                        if (get().selectedGroup?.id === groupId) {
                            resetGroupActivityPagination();
                        }
                        void dropGroupFromList(groupId, readStartedAt);
                        set(state => ({
                            selectedGroup:
                                state.selectedGroup?.id === groupId ? null : state.selectedGroup,
                        }));
                    }
                }
                return get().selectedGroup?.id === groupId ? get().selectedGroup : null;
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('group', 'data', 'fetched');
                }
            });
    },
    fetchMoreGroupActivity: () => {
        const selectedGroup = get().selectedGroup;
        const groupId = selectedGroup?.id;
        const nextCursor = selectedGroup?.recentActivities.nextCursor;
        const { setLoading, group } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        if (
            !groupId ||
            nextCursor === null ||
            nextCursor === undefined ||
            group.nextPage === 'loading'
        ) {
            return Promise.resolve();
        }

        clearError('group', 'nextPage');
        setLoading('group', 'nextPage', 'loading');

        const request = groupActivityPageChannel.request(
            signal =>
                activityApi.fetchGroupActivityPreviews(
                    {
                        groupId,
                        limit: ACTIVITY_API_LIMIT,
                        cursor: nextCursor,
                    },
                    signal,
                ),
            { identity: `${groupId}:${nextCursor}` },
        );

        return request.promise
            .then(data => {
                if (!request.isCurrent() || get().selectedGroup?.id !== groupId) {
                    return;
                }

                set(state => {
                    const currentGroup = state.selectedGroup;

                    if (!currentGroup || currentGroup.id !== groupId) {
                        return {};
                    }

                    return {
                        selectedGroup: {
                            ...currentGroup,
                            recentActivities: {
                                ...currentGroup.recentActivities,
                                items: appendUniqueActivityPreviews(
                                    currentGroup.recentActivities.items,
                                    data.items,
                                ),
                                nextCursor: data.nextCursor,
                            },
                        },
                    };
                });
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('group', 'nextPage', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('group', 'nextPage', 'fetched');
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
                    resetGroupActivityPagination();
                    set({ selectedGroup: newGroup });
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
    updateGroup: ({ groupName, groupDescription, simplifyDebts }) => {
        const selectedGroup = get().selectedGroup;
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const isCurrent = createGroupsMutationGuard();

        if (!selectedGroup) {
            const error = new Error('No selected group');
            setError('group', 'update', normalizeApiError(error));
            return Promise.reject(error);
        }

        if (activeGroupUpdate?.isCurrent()) {
            return activeGroupUpdate.promise;
        }

        clearError('group', 'update');
        setLoading('group', 'update', 'loading');

        const groupId = selectedGroup.id;
        const updatePromise = groupsApi
            .updateGroup({
                groupId,
                ...(groupName !== undefined && { groupName }),
                ...(groupDescription !== undefined && { groupDescription }),
                ...(simplifyDebts !== undefined && { simplifyDebts }),
            })
            .then(updatedGroup => {
                if (isCurrent()) {
                    if (get().selectedGroup?.id === groupId) {
                        groupDetailChannel.abort();
                        setLoading('group', 'data', 'fetched');
                    }
                    set(state => ({
                        selectedGroup:
                            state.selectedGroup?.id === groupId
                                ? updatedGroup
                                : state.selectedGroup,
                    }));
                }
                if (!isCurrent()) {
                    return updatedGroup;
                }

                return reloadGroupsListWith(updatedGroup, isCurrent).then(() => updatedGroup);
            })
            .catch((error: unknown) => {
                if (isCurrent()) {
                    setError('group', 'update', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (activeGroupUpdate?.promise === updatePromise) {
                    activeGroupUpdate = undefined;
                    if (isCurrent()) {
                        setLoading('group', 'update', 'fetched');
                    }
                }
            });

        activeGroupUpdate = {
            groupId,
            isCurrent,
            promise: updatePromise,
        };

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
                if (isCurrent()) {
                    if (get().selectedGroup?.id === updatedGroup.id) {
                        groupDetailChannel.abort();
                        setLoading('group', 'data', 'fetched');
                    }
                    set(state => ({
                        selectedGroup:
                            state.selectedGroup?.id === updatedGroup.id
                                ? updatedGroup
                                : state.selectedGroup,
                    }));
                }
                if (!isCurrent()) {
                    return updatedGroup;
                }

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

                if (get().selectedGroup?.id === groupId) {
                    get().setSelectedGroup(null);
                }
                return refreshAfterGroupRemoval();
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

                if (get().selectedGroup?.id === groupId) {
                    get().setSelectedGroup(null);
                }
                return refreshAfterGroupRemoval();
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
                if (!isCurrent()) {
                    return joinedGroup;
                }

                groupDetailChannel.abort();
                resetGroupActivityPagination();
                setLoading('group', 'data', 'fetched');
                successfulJoinVersions[joinedGroup.id] =
                    (successfulJoinVersions[joinedGroup.id] ?? 0) + 1;
                set({ selectedGroup: joinedGroup });

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
