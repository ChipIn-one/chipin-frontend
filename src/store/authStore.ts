import { create } from 'zustand';

import { deleteAuthTokenDB } from './IDB/auth';

interface AuthStore {
    isLoggedIn: boolean;
    setIsLoggedIn: (isLoggedIn: boolean) => void;
    signOut: () => Promise<void>;
}

const initialAuthStore = {
    isLoggedIn: false,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
    ...initialAuthStore,

    setIsLoggedIn: (isLogged: boolean) => {
        const { isLoggedIn } = get();
        console.log('Setting isLoggedIn:', isLoggedIn, '->', isLoggedIn);
        set({ isLoggedIn: isLogged });
    },

    signOut: async () => {
        await deleteAuthTokenDB();
        set({ isLoggedIn: false });
    },
}));
