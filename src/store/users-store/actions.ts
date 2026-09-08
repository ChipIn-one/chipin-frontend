import { create } from 'zustand';

import type { UpdateUserParams } from 'api/chipin.types';
import * as usersApi from 'api/usersApi';
import { DAY, SECOND } from 'constants/time';
import { normalizeApiError } from 'helpers/errors';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { getUnixTimestampInSec } from 'helpers/time';

import { useErrorsStore } from '../errorsStore';
import { createRequestChannel } from '../internal/resourceRequests';
import { useLoadingStore } from '../loadingStore';

import { createInitialState } from './initialState';
import type { UsersStore } from './types';

const userChannel = createRequestChannel();
const friendsChannel = createRequestChannel();
let profileMutationQueue = Promise.resolve();
let profileMutationGeneration = 0;
let settingsMutationId = 0;
let avatarMutationId = 0;

class ProfileMutationCancelledError extends Error {}

interface ProfileMutationHandle<T> {
    promise: Promise<T>;
    isCurrent: () => boolean;
}

const enqueueProfileMutation = <T>(loader: () => Promise<T>): ProfileMutationHandle<T> => {
    const generation = profileMutationGeneration;
    const authSessionVersion = getAuthSessionVersion();
    const isCurrent = () => {
        return (
            generation === profileMutationGeneration &&
            isAuthSessionCurrent(authSessionVersion)
        );
    };
    const promise = profileMutationQueue
        .then(() => {
            if (!isCurrent()) {
                return Promise.reject(new ProfileMutationCancelledError());
            }

            return loader();
        })
        .then(
            result => {
                if (!isCurrent()) {
                    return Promise.reject(new ProfileMutationCancelledError());
                }

                return result;
            },
            (error: unknown) => {
                if (!isCurrent()) {
                    return Promise.reject(new ProfileMutationCancelledError());
                }

                return Promise.reject(error);
            },
        );

    profileMutationQueue = promise.then(
        () => undefined,
        () => undefined,
    );

    return { promise, isCurrent };
};

const useUsersStore = create<UsersStore>((set, get) => ({
    ...createInitialState(),

    fetchSetUser: (force = false) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('users', 'self');

        const request = userChannel.request(usersApi.fetchUser, { force });
        setLoading('users', 'self', 'loading');

        return request.promise
            .then(user => {
                if (!request.isCurrent()) {
                    return user;
                }

                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });

                return user;
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('users', 'self', normalizeApiError(error));
                }
                return get().user;
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('users', 'self', 'fetched');
                }
            });
    },
    fetchSetFriends: (force = false) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('users', 'friends');

        const request = friendsChannel.request(usersApi.fetchKnownUsers, { force });
        setLoading('users', 'friends', 'loading');

        return request.promise
            .then(({ friends }) => {
                if (request.isCurrent()) {
                    set({ friends });
                }
            })
            .catch((error: unknown) => {
                if (request.isCurrent()) {
                    setError('users', 'friends', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (request.isCurrent()) {
                    setLoading('users', 'friends', 'fetched');
                }
            });
    },
    removeFriend: ({ userId }) => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        clearError('users', 'removeFriend');
        setLoading('users', 'removeFriend', 'loading');

        return usersApi
            .removeKnownUser({ userId })
            .catch((error: unknown) => {
                setError('users', 'removeFriend', normalizeApiError(error));
                return Promise.reject(error);
            })
            .then(() => get().fetchSetFriends(true))
            .finally(() => {
                setLoading('users', 'removeFriend', 'fetched');
            });
    },
    setUserSettings: params => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const request = {
            ...(params.displayName !== undefined && { displayName: params.displayName }),
            ...(params.settings && { settings: params.settings }),
        } satisfies UpdateUserParams;
        const mutationId = ++settingsMutationId;
        clearError('users', 'settings');
        setLoading('users', 'settings', 'loading');

        const mutation = enqueueProfileMutation(() => usersApi.updateUser(request));

        return mutation.promise
            .then(user => {
                if (!mutation.isCurrent()) {
                    return;
                }

                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });
            })
            .catch((error: unknown) => {
                if (error instanceof ProfileMutationCancelledError) {
                    return;
                }
                if (mutationId === settingsMutationId && mutation.isCurrent()) {
                    setError('users', 'settings', normalizeApiError(error));
                }
            })
            .finally(() => {
                if (mutationId === settingsMutationId) {
                    setLoading('users', 'settings', 'fetched');
                }
            });
    },
    uploadUserAvatar: params => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();
        const mutationId = ++avatarMutationId;
        clearError('users', 'avatar');
        setLoading('users', 'avatar', 'loading');

        const mutation = enqueueProfileMutation(() => usersApi.uploadUserAvatar(params));

        return mutation.promise
            .then(user => {
                if (!mutation.isCurrent()) {
                    return Promise.reject(new ProfileMutationCancelledError());
                }

                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });

                return user;
            })
            .catch((error: unknown) => {
                if (
                    !(error instanceof ProfileMutationCancelledError) &&
                    mutationId === avatarMutationId &&
                    mutation.isCurrent()
                ) {
                    setError('users', 'avatar', normalizeApiError(error));
                }
                return Promise.reject(error);
            })
            .finally(() => {
                if (mutationId === avatarMutationId) {
                    setLoading('users', 'avatar', 'fetched');
                }
            });
    },
    extendUserSubscriptionByDay: () => {
        set(state => {
            if (!state.user) {
                return state;
            }

            const dayInSeconds = DAY / SECOND;
            const baseTimestamp =
                typeof state.user.subscriptionUntil === 'number'
                    ? state.user.subscriptionUntil
                    : getUnixTimestampInSec();

            return {
                user: {
                    ...state.user,
                    subscriptionUntil: baseTimestamp + dayInSeconds,
                },
            };
        });
    },
    setInitialUsersStore: () => {
        userChannel.abort();
        friendsChannel.abort();
        profileMutationGeneration += 1;
        settingsMutationId += 1;
        avatarMutationId += 1;
        set(createInitialState());
        useErrorsStore.getState().resetErrors();
    },
}));

export { useUsersStore };
