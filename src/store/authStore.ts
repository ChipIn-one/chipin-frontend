import { create } from 'zustand';

interface AuthStore {
    test: number;
    setTest: (test: number) => void;
}

const initialAuthStore = {
    test: 0,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
    ...initialAuthStore,

    setTest: (test: number) => {
        const { test: currentTest } = get();

        set({
            test: currentTest + test,
        });
    },
}));
