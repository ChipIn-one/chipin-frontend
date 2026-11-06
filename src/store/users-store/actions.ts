import { create } from 'zustand';

import * as usersApi from 'api/usersApi';
import { normalizeApiError } from 'helpers/errors';
import { saveLocalUser, toLocalUser } from 'helpers/localStorage';

import { useErrorsStore } from '../errorsStore';
import { createRequestChannel } from '../internal/resourceRequests';
import { invalidateKnownUsers, seedSelfUser } from '../internal/usersQueryBridge';
import { useLoadingStore } from '../loadingStore';

import { createInitialState } from './initialState';
import type { UsersStore } from './types';

const userChannel = createRequestChannel();

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
                set({ user, localUser: nextLocalUser, hasConfirmedUser: true });
                seedSelfUser(user);

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
    invalidateKnownUsers: options => invalidateKnownUsers(get().localUser?.id, options),
    setInitialUsersStore: () => {
        userChannel.abort();
        set(createInitialState());
        useErrorsStore.getState().resetErrors();
    },
}));

export { useUsersStore };
