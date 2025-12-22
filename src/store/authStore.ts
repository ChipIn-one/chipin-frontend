import { create } from 'zustand';

import { deleteAuthTokenDB } from './IDB/auth';

interface AuthStore {
    isLoggedIn: boolean;
    isAuthChecked?: boolean; // used for protecting routes until we check auth status
    setIsLoggedIn: (isLoggedIn: boolean) => void;
    setIsAuthChecked: (isLoggedIn: boolean) => void;
    signOut: () => Promise<void>;
}

const initialAuthStore = {
    isLoggedIn: false,
    isAuthChecked: false,
};

export const useAuthStore = create<AuthStore>(set => ({
    ...initialAuthStore,

    setIsLoggedIn: (isLogged: boolean) => {
        set({ isLoggedIn: isLogged });
    },

    setIsAuthChecked: (isLoggedIn: boolean) => {
        set({ isAuthChecked: true, isLoggedIn });
    },

    signOut: async () => {
        await deleteAuthTokenDB();
        set({ isLoggedIn: initialAuthStore.isLoggedIn });
    },
}));
