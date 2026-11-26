// The group mutations for the UI (spec 03 §6 row 4). Like the users mutations, they run only while
// signed in on the user's persisted client, and offline they are refused before `mutate` (spec 03
// §2.9: group writes need the network), so nothing waits paused for a reconnect. A refusal or a
// failure rejects: the caller shows it with `toastGroupWriteError`. `isPending` is true while any
// write of that kind runs on the user's client (a modal and the settings tab share it).
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateSelfActivity } from 'entities/activity';
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
import { useUiPrefsStore } from 'store/ui-prefs';

import { toastWriteRefusal, useIsUserWriteEnabled } from './useUserMutations';

/**
 * Why a group write was not sent: `session` — signed out or on the anonymous client, or (for a
 * queued update) the group was left or removed meanwhile; both are silent. `offline` — no network
 * (spec 03 §2.9).
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

// Spec 03 §2.9: `<OnlineOnly>` / `useRequiresOnline()` disable the controls offline, whether
// offline writes are on or off (03-16a part C, KB NET-006, #866). For a control used as the network
// went, an offline write is refused here and the caller's toast shows it.
const refusalBeforeMutate = (isEnabled: boolean): Promise<never> | null => {
    if (!isEnabled) {
        return Promise.reject(new GroupWriteRefusedError('session'));
    }
    return isNetworkUsable() ? null : Promise.reject(new GroupWriteRefusedError('offline'));
};

// After a group write (spec 02 D5: the entity does not import the stores): the last-group default
// of a lost group, and the user's own activity feeds (`activity.self`) on the write's client.
const storeEffects: GroupWriteEffects = {
    onGroupGone: (groupId, client) => {
        const { lastGroupId, setLastGroupId } = useUiPrefsStore.getState();

        if (lastGroupId === groupId) {
            setLastGroupId(null);
        }
        return invalidateSelfActivity(client);
    },
    onMembersChanged: (_groupId, client) => invalidateSelfActivity(client),
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

interface ChainedUpdate {
    sessionVersion: number;
    values: string;
    promise: Promise<Group>;
}

// The last update (running or queued) of each group on each client (#893). An update of the same
// group in the same session waits until the last one settles, then is sent; only one with the same
// values as the last joins it instead of sending another request.
const chainedUpdates = new WeakMap<QueryClient, Map<string, ChainedUpdate>>();

const chainedUpdatesOf = (client: QueryClient): Map<string, ChainedUpdate> => {
    const updates = chainedUpdates.get(client) ?? new Map<string, ChainedUpdate>();

    chainedUpdates.set(client, updates);
    return updates;
};

// The identity of an update's values: a field left out differs from one set.
const updateValues = ({ groupName, groupDescription, simplifyDebts }: UpdateGroupParams): string =>
    JSON.stringify([groupName ?? null, groupDescription ?? null, simplifyDebts ?? null]);

// The leave and remove writes of a group on a client: the ones made after an update was queued end
// its turn unless they failed (the group is gone for the user, or going).
const GROUP_GONE_KEYS = [groupsMutationKeys.leave, groupsMutationKeys.remove];

const groupGoneWrites = (client: QueryClient, groupId: string) =>
    GROUP_GONE_KEYS.flatMap(mutationKey =>
        client.getMutationCache().findAll({
            mutationKey,
            predicate: ({ state: { variables } }) =>
                typeof variables === 'object' &&
                variables !== null &&
                'groupId' in variables &&
                variables.groupId === groupId,
        }),
    );

/**
 * Resolves with the updated group once the list has reloaded with it. An update with the same
 * values as the last one of the group joins it; another is sent after the previous one settles,
 * and settles on its own.
 */
export const useUpdateGroup = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(updateGroupMutationOptions());
    const updateGroup = useCallback(
        (params: UpdateGroupParams): Promise<Group> => {
            const updates = chainedUpdatesOf(client);
            const values = updateValues(params);
            const last = updates.get(params.groupId);
            // An update of an earlier session neither joins nor holds back one of this session.
            const previous = last && isAuthSessionCurrent(last.sessionVersion) ? last : null;

            if (previous?.values === values) {
                return previous.promise;
            }
            const refusal = refusalBeforeMutate(isEnabled);

            if (refusal) {
                return refusal;
            }
            const sessionVersion = getAuthSessionVersion();
            const variables = { ...params, sessionVersion };
            // Only settled ones: a leave or remove still running at the call counts as made since.
            const goneWritesBefore = new Set(
                groupGoneWrites(client, params.groupId)
                    .filter(({ state }) => state.status !== 'pending')
                    .map(({ mutationId }) => mutationId),
            );
            const isGroupGoneSince = (): boolean =>
                groupGoneWrites(client, params.groupId).some(
                    ({ mutationId, state }) =>
                        !goneWritesBefore.has(mutationId) && state.status !== 'error',
                );
            // Its turn after the previous one: refused (silently, as an ended session) if the
            // session ended or the group was left or removed meanwhile, or refused offline. It is
            // sent through the cache, not the observer, which may have unmounted by then.
            const sendInTurn = (): Promise<Group> =>
                isAuthSessionCurrent(sessionVersion) && !isGroupGoneSince()
                    ? (refusalBeforeMutate(isEnabled) ??
                      client
                          .getMutationCache()
                          .build(
                              client,
                              client.defaultMutationOptions(updateGroupMutationOptions()),
                          )
                          .execute(variables))
                    : Promise.reject(new GroupWriteRefusedError('session'));
            const promise = (
                previous ? previous.promise.then(sendInTurn, sendInTurn) : mutateAsync(variables)
            ).finally(() => {
                if (updates.get(params.groupId)?.promise === promise) {
                    updates.delete(params.groupId);
                }
            });
            updates.set(params.groupId, { sessionVersion, values, promise });
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
