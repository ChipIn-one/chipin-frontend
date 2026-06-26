import { create } from 'zustand';

import { fetchApiKnownUsers, fetchApiUser } from 'api/chipin';
import { SettledFriend, UnsettledFriends, User } from 'api/chipin.types';
import { DAY, SECOND } from 'constants/time';
import { getUnixTimestampInSec } from 'helpers/time';

import { useLoadingStore } from './loadingStore';

export interface UsersStore {
    user: User | null;
    unSettledFriends: UnsettledFriends[];
    settledFriends: SettledFriend[];

    fetchSetFriends: () => void;
    fetchSetUser: () => void;
    extendUserSubscriptionByDay: () => void;
    resetUsers: () => void;
}

const initialUsersStore = {
    user: null,
    unSettledFriends: [],
    settledFriends: [],
};

export const useUsersStore = create<UsersStore>(set => ({
    ...initialUsersStore,

    fetchSetUser: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'self', 'loading');

        fetchApiUser()
            .then(user => {
                set({ user });
            })
            .catch(error => {
                console.error('Error fetching user:', error);
            })
            .finally(() => {
                setLoading('users', 'self', 'fetched');
            });
    },
    fetchSetFriends: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'friends', 'loading');

        fetchApiKnownUsers()
            .then(({ currencies, settledFriends }) => {
                set({ unSettledFriends: currencies, settledFriends });
            })
            .catch(error => {
                console.error('Error fetching known users:', error);
            })
            .finally(() => {
                setLoading('users', 'friends', 'fetched');
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
    resetUsers: () => {
        set(initialUsersStore);
    },
}));
