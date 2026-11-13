// The group mutations for the UI (spec 03 §6 row 4). Like the users mutations, they run only while
// signed in on the user's persisted client, and offline they are refused before `mutate` (spec 03
// §2.9: group writes need the network), so nothing waits paused for a reconnect. A refusal or a
// failure rejects: the caller shows it with `toastGroupWriteError`. `isPending` is true while any
// write of that kind runs on the user's client (a modal and the settings tab share it).
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
    createGroupMutationOptions,
    type CreateGroupParams,
    type Group,
    groupsMutationKeys,
    type GroupWriteEffects,
    joinGroupMutationOptions,
    kickGroupMemberMutationOptions,
    type KickGroupMemberParams,
    leaveGroupMutationOptions,
    type LeaveGroupParams,
    removeGroupMutationOptions,
    updateGroupMutationOptions,
    type UpdateGroupParams,
    uploadGroupCoverMutationOptions,
    type UploadGroupCoverParams,
} from 'entities/groups';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { isNetworkUsable } from 'shared/offline/network';
import { useActivityStore } from 'store/activity-store';
import { useUiPrefsStore } from 'store/ui-prefs';

import { toastWriteRefusal, useIsUserWriteEnabled } from './useUserMutations';

/**
 * Why a group write was not sent: `session` — signed out or on the anonymous client; `offline` —
 * no network (spec 03 §2.9).
 */
export type GroupWriteRefusal = 'session' | 'offline';

/** A group write refused before it was sent. */
export class GroupWriteRefusedError extends Error {
    readonly reason: GroupWriteRefusal;

    constructor(reason: GroupWriteRefusal) {
        super(`Group write refused: ${reason}`);
        this.reason = reason;
    }
}

/**
 * The toast of a group write that rejected. A refusal shows what a refused user write shows
 * (`toastWriteRefusal`: offline says so, an ended session nothing); any other failure its backend
 * message, or `fallbackMessage`.
 */
export const toastGroupWriteError = (error: unknown, fallbackMessage: string): void => {
    if (error instanceof GroupWriteRefusedError) {
        toastWriteRefusal(error.reason);
        return;
    }
    toast.error(resolveApiErrorMessageFromError(error, fallbackMessage));
};

// TODO(spec 03 §2.9): disable the controls offline with `useRequiresOnline()` / `<OnlineOnly>`
// once they exist; until then an offline write is refused here and the caller's toast shows it.
const refusalBeforeMutate = (isEnabled: boolean): Promise<never> | null => {
    if (!isEnabled) {
        return Promise.reject(new GroupWriteRefusedError('session'));
    }
    return isNetworkUsable() ? null : Promise.reject(new GroupWriteRefusedError('offline'));
};

// The legacy stores after a group write (spec 02 D5: the entity does not import them): the
// last-group default of a lost group, and the legacy activity feed until 03-12.
const storeEffects: GroupWriteEffects = {
    onGroupGone: groupId => {
        const { lastGroupId, setLastGroupId } = useUiPrefsStore.getState();

        if (lastGroupId === groupId) {
            setLastGroupId(null);
        }
        return useActivityStore.getState().fetchSetActivity(true);
    },
    onMembersChanged: () => useActivityStore.getState().fetchSetActivity(true),
};

const useIsWriting = (mutationKey: readonly string[]): boolean =>
    useIsMutating({ mutationKey }) > 0;

const GROUP_FORM_KEYS: readonly (readonly string[])[] = [
    groupsMutationKeys.create,
    groupsMutationKeys.update,
    groupsMutationKeys.uploadCover,
];

/** Whether a group is being created, updated or given a cover (the group modal stays open). */
export const useIsGroupFormSaving = (): boolean =>
    useIsMutating({
        predicate: mutation =>
            GROUP_FORM_KEYS.some(key =>
                key.every((part, i) => mutation.options.mutationKey?.[i] === part),
            ),
    }) > 0;

/** Resolves with the created group; it is listed and becomes its detail at once. */
export const useCreateGroup = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(createGroupMutationOptions());
    const createGroup = useCallback(
        (params: CreateGroupParams): Promise<Group> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );

    return { createGroup, isPending: useIsWriting(groupsMutationKeys.create) };
};

interface RunningUpdate {
    sessionVersion: number;
    promise: Promise<Group>;
}

// The running update of each group on each client: a second update of the same group in the same
// session joins it instead of sending another request.
const runningUpdates = new WeakMap<QueryClient, Map<string, RunningUpdate>>();

const runningUpdatesOf = (client: QueryClient): Map<string, RunningUpdate> => {
    const updates = runningUpdates.get(client) ?? new Map<string, RunningUpdate>();

    runningUpdates.set(client, updates);
    return updates;
};

/** Resolves with the updated group once the list has reloaded with it. */
export const useUpdateGroup = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(updateGroupMutationOptions());
    const updateGroup = useCallback(
        (params: UpdateGroupParams): Promise<Group> => {
            const updates = runningUpdatesOf(client);
            const running = updates.get(params.groupId);

            if (running && isAuthSessionCurrent(running.sessionVersion)) {
                return running.promise;
            }
            const refusal = refusalBeforeMutate(isEnabled);

            if (refusal) {
                return refusal;
            }
            const sessionVersion = getAuthSessionVersion();
            const promise = mutateAsync({ ...params, sessionVersion }).finally(() => {
                if (updates.get(params.groupId)?.promise === promise) {
                    updates.delete(params.groupId);
                }
            });

            updates.set(params.groupId, { sessionVersion, promise });
            return promise;
        },
        [client, isEnabled, mutateAsync],
    );

    return { updateGroup, isPending: useIsWriting(groupsMutationKeys.update) };
};

/** Resolves with the group with its new cover once the list has reloaded with it. */
export const useUploadGroupCover = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(uploadGroupCoverMutationOptions());
    const uploadGroupCover = useCallback(
        (params: UploadGroupCoverParams): Promise<Group> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );

    return { uploadGroupCover, isPending: useIsWriting(groupsMutationKeys.uploadCover) };
};

/** Resolves with the joined group once the list has reloaded with it. */
export const useJoinGroup = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(joinGroupMutationOptions());

    return useCallback(
        (inviteToken: string): Promise<Group> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ inviteToken, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );
};

/** Settles once what showed the group has reloaded. */
export const useLeaveGroup = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(leaveGroupMutationOptions(storeEffects));
    const leaveGroup = useCallback(
        (params: LeaveGroupParams): Promise<void> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );

    return { leaveGroup, isPending: useIsWriting(groupsMutationKeys.leave) };
};

/** Settles once the group and what shows its members have reloaded. */
export const useKickGroupMember = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(kickGroupMemberMutationOptions(storeEffects));
    const kickGroupMember = useCallback(
        (params: KickGroupMemberParams): Promise<void> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );

    return { kickGroupMember, isPending: useIsWriting(groupsMutationKeys.kick) };
};

/** Settles once what showed the group has reloaded. */
export const useRemoveGroup = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(removeGroupMutationOptions(storeEffects));
    const removeGroup = useCallback(
        (groupId: string): Promise<void> =>
            refusalBeforeMutate(isEnabled) ??
            mutateAsync({ groupId, sessionVersion: getAuthSessionVersion() }),
        [isEnabled, mutateAsync],
    );

    return { removeGroup, isPending: useIsWriting(groupsMutationKeys.remove) };
};
