// The users mutations for the UI (spec 03 §6 row 3). Like the queries (`useSelfUser`), they run
// only while signed in on the user's persisted client: never signed out, never on the anonymous
// client of a first sign-in. Offline they are refused before `mutate` (spec 03 §2.9: settings,
// the avatar and removing a friend need the network), so nothing waits paused for a reconnect.
import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { toast } from 'sonner';

import { DAY, SECOND } from 'constants/time';
import {
    type AcceptedFriend,
    acceptFriendInviteMutationOptions,
    removeKnownUserMutationOptions,
    type SelfUser,
    updateSelfMutationOptions,
    type UpdateSelfParams,
    uploadAvatarMutationOptions,
    type UploadAvatarParams,
    usersKeys,
} from 'entities/users';
import { normalizeApiError } from 'helpers/errors';
import { getUnixTimestampInSec } from 'helpers/time';
import { isNetworkUsable } from 'shared/offline/network';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

/** A users write refused before it was sent: offline, or no signed-in user on this client. */
export class UserWriteRefusedError extends Error {}

const useIsUserWriteEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

const refuse = (): Promise<never> => Promise.reject(new UserWriteRefusedError());

const refuseOffline = (): Promise<never> => {
    toast.error(i18n.t('errors:network.offline'));
    return refuse();
};

const toastError = (error: unknown): Promise<never> => {
    if (!(error instanceof UserWriteRefusedError)) {
        toast.error(normalizeApiError(error).message);
    }
    return Promise.reject(error);
};

/** `updateSelf` never rejects: a failure is a toast and the change is rolled back. */
export const useUpdateSelf = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync, isPending } = useMutation(updateSelfMutationOptions());
    const updateSelf = useCallback(
        (changes: UpdateSelfParams): Promise<void> => {
            const write = !isEnabled ? refuse() : !isNetworkUsable() ? refuseOffline() : null;

            return (write ?? mutateAsync(changes).catch(toastError)).then(
                () => undefined,
                () => undefined,
            );
        },
        [isEnabled, mutateAsync],
    );

    return { updateSelf, isPending };
};

/** Rejects on a failure (after a toast), so the caller keeps its draft. */
export const useUploadAvatar = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync, isPending } = useMutation(uploadAvatarMutationOptions());
    const uploadAvatar = useCallback(
        (params: UploadAvatarParams): Promise<SelfUser> => {
            if (!isEnabled) {
                return refuse();
            }
            return isNetworkUsable() ? mutateAsync(params).catch(toastError) : refuseOffline();
        },
        [isEnabled, mutateAsync],
    );

    return { uploadAvatar, isPending };
};

/** Rejects on a failure (after a toast); settles once the friends list has reloaded. */
export const useRemoveKnownUser = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync, isPending } = useMutation(removeKnownUserMutationOptions());
    const removeKnownUser = useCallback(
        (userId: string): Promise<void> => {
            if (!isEnabled) {
                return refuse();
            }
            return isNetworkUsable() ? mutateAsync({ userId }).catch(toastError) : refuseOffline();
        },
        [isEnabled, mutateAsync],
    );

    return { removeKnownUser, isPending };
};

/** Rejects on a failure: the invite page shows the error itself. */
export const useAcceptFriendInvite = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(acceptFriendInviteMutationOptions());

    return useCallback(
        (inviteToken: string): Promise<AcceptedFriend> =>
            isEnabled && isNetworkUsable() ? mutateAsync({ inviteToken }) : refuse(),
        [isEnabled, mutateAsync],
    );
};

/** Dev menu only: the shown subscription runs one day longer (in the cache, not on the server). */
export const useExtendSubscriptionByDay = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();

    return useCallback(() => {
        if (!isEnabled) {
            return;
        }
        void client.cancelQueries({ queryKey: usersKeys.self() }).then(() => {
            client.setQueryData<SelfUser>(usersKeys.self(), user =>
                user
                    ? {
                          ...user,
                          subscriptionUntil:
                              (user.subscriptionUntil ?? getUnixTimestampInSec()) + DAY / SECOND,
                      }
                    : user,
            );
        });
    }, [client, isEnabled]);
};
