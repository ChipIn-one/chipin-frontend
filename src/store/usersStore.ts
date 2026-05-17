import { create } from 'zustand';

import { fetchApiKnownUsers, fetchApiUser } from 'api/chipin';
import { Friend, User } from 'api/chipin.types';

import { useLoadingStore } from './loadingStore';

export interface UsersStore {
    user: User | null;
    settings: {
        defaultCurrency: string;
    };
    friends: Friend[];

    fetchSetFriends: () => void;
    fetchSetUser: () => void;
}

const initialUsersStore = {
    user: null,
    settings: {
        defaultCurrency: 'USD',
    },
    friends: [],
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
            .then(friends => {
                set({ friends });
            })
            .catch(error => {
                console.error('Error fetching known users:', error);
            })
            .finally(() => {
                setLoading('users', 'friends', 'fetched');
            });
    },
}));
