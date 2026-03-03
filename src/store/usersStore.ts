import { create } from 'zustand';

import { fetchApiKnownUsers, fetchApiUser } from 'api/chipin';
import { ApiUser } from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';

interface UsersStore {
    isLoadingUsers: boolean;

    user: ApiUser | null;
    friends: ApiUser[];

    fetchSetFriends: () => void;
    fetchSetUser: () => void;
}

const initialUsersStore = {
    isLoadingUsers: false,
    user: null,
    friends: [],
};

export const useUsersStore = create<UsersStore>(set => ({
    ...initialUsersStore,

    fetchSetUser: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'self', true);

        fetchApiUser()
            .then(user => {
                set({ user });
            })
            .catch(error => {
                console.error('Error fetching user:', error);
            })
            .finally(() => {
                setLoading('users', 'self', false);
            });
    },
    fetchSetFriends: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'friends', true);

        fetchApiKnownUsers()
            .then(friends => {
                set({ friends });
            })
            .catch(error => {
                console.error('Error fetching known users:', error);
            })
            .finally(() => {
                setLoading('users', 'friends', false);
            });
    },
}));
