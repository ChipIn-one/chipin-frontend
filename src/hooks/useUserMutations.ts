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
    type UserWriteRefusal,
    UserWriteRefusedError,
} from 'entities/users';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { normalizeApiError } from 'helpers/errors';
import { getUnixTimestampInSec } from 'helpers/time';
import { ApiError } from 'shared/lib/apiError';
import { isNetworkUsable } from 'shared/offline/network';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

/** Signed in on the user's persisted client: the only place user and group writes run. */
export const useIsUserWriteEnabled = (): boolean => {
    const isSignedIn = useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

const refuse = (reason: UserWriteRefusal): Promise<never> =>
    Promise.reject(new UserWriteRefusedError(reason));

/**
 * What a refused write shows, for the user and the group writes alike: offline says so; an ended
 * session (signed out, the anonymous client) shows nothing.
 */
export const toastWriteRefusal = (reason: UserWriteRefusal): void => {
    if (reason === 'offline') {
        toast.error(i18n.t('errors:network.offline'));
    }
};

// TODO(spec 03 §2.9): disable the controls offline with `useRequiresOnline()` / `<OnlineOnly>`
// once they exist; until then an offline write is refused here with a toast.
const refuseOffline = (): Promise<never> => {
    toastWriteRefusal('offline');
    return refuse('offline');
};

// Refused before `mutate`: signed out or on the anonymous client (no toast), or offline.
const refusalBeforeMutate = (isEnabled: boolean): Promise<never> | null => {
    if (!isEnabled) {
        return refuse('session');
    }
    return isNetworkUsable() ? null : refuseOffline();
};

// A failure of a write made in `sessionVersion`: nothing is shown once that session has ended (a
// sign-out or an account switch is not this write's error). A backend error has its translated
// message; anything else (network, timeout, an invalid path segment) the generic one.
const toastError =
    (sessionVersion: number) =>
    (error: unknown): Promise<never> => {
        if (isAuthSessionCurrent(sessionVersion)) {
            if (error instanceof UserWriteRefusedError) {
                toastWriteRefusal(error.reason);
            } else {
                toast.error(
                    error instanceof ApiError
                        ? normalizeApiError(error).message
                        : i18n.t('toasts:common.requestFailed'),
                );
            }
        }
        return Promise.reject(error);
    };

/** `updateSelf` never rejects: a failure is a toast and the change is rolled back. */
export const useUpdateSelf = () => {
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync, isPending } = useMutation(updateSelfMutationOptions());
    const updateSelf = useCallback(
        (changes: UpdateSelfParams): Promise<void> => {
            const sessionVersion = getAuthSessionVersion();
            const write =
                refusalBeforeMutate(isEnabled) ??
                mutateAsync({ changes, sessionVersion }).catch(toastError(sessionVersion));

            return write.then(
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
            const sessionVersion = getAuthSessionVersion();

            return (
                refusalBeforeMutate(isEnabled) ??
                mutateAsync({ ...params, sessionVersion }).catch(toastError(sessionVersion))
            );
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
            const sessionVersion = getAuthSessionVersion();

            return (
                refusalBeforeMutate(isEnabled) ??
                mutateAsync({ userId }).catch(toastError(sessionVersion))
            );
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
            isEnabled && isNetworkUsable()
                ? mutateAsync({ inviteToken })
                : refuse(isEnabled ? 'offline' : 'session'),
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
