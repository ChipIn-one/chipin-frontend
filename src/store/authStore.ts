import { create } from 'zustand';

interface AuthStore {
    isLoggedIn: boolean;
    setIsLoggedIn: (isLoggedIn: boolean) => void;
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
}));
