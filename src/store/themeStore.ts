import { create } from 'zustand';

interface ThemeStore {
    isDarkTheme: boolean;
    themeName: string;
    setTheme: (themeName: string) => void;
    toggleTheme: () => void;
}

const initialThemeStore = {
    isDarkTheme: false,
    themeName: 'system',
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
    ...initialThemeStore,

    setTheme: (themeName: string) => {
        set({ themeName });
    },

    toggleTheme: () => {
        const { isDarkTheme } = get();
        set({ isDarkTheme: !isDarkTheme });
    },
}));
