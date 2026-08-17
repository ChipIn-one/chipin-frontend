import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import { checkIsPwaInstalled } from 'helpers/pwa';

interface PwaStore {
    isPwaInstalled: boolean;
    pwaInstallPrompt: BeforeInstallPromptEvent | null;
    isSwUpdateAvailable: boolean;
    setIsPwaInstalled: (isPwaInstalled: boolean) => void;
    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => void;
    setIsSwUpdateAvailable: (isSwUpdateAvailable: boolean) => void;
    callPWAInstall: () => Promise<void>;
}

const initialPWAStore = {
    isPwaInstalled: checkIsPwaInstalled(),
    pwaInstallPrompt: null,
    isSwUpdateAvailable: false,
};

export const usePwaStore = create<PwaStore>((set, get) => ({
    ...initialPWAStore,

    setIsPwaInstalled: (isPwaInstalled: boolean) => {
        set({ isPwaInstalled });
    },

    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => {
        set({ pwaInstallPrompt });
    },

    setIsSwUpdateAvailable: (isSwUpdateAvailable: boolean) => {
        set({ isSwUpdateAvailable });
    },

    callPWAInstall: () => {
        const { pwaInstallPrompt } = get();

        if (!pwaInstallPrompt) {
            return Promise.resolve();
        }

        return pwaInstallPrompt
            .prompt()
            .then(() => pwaInstallPrompt.userChoice)
            .then(({ outcome }) => {
                if (outcome === 'accepted') {
                    set({ isPwaInstalled: true, pwaInstallPrompt: null });
                    toast.success(i18n.t('toasts:pwa.installing'));
                    return;
                }

                set({ pwaInstallPrompt: null });
            });
    },
}));
