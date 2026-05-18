import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import { checkIsPwaInstallable, checkIsPwaInstalled } from 'helpers/pwa';

interface PwaStore {
    isPwaInstalled: boolean;
    isPwaInstallable: boolean;
    pwaInstallPrompt: BeforeInstallPromptEvent | null;
    isSwUpdateAvailable: boolean;
    setIsPwaInstallable: (isPwaInstallable: boolean) => void;
    setIsPwaInstalled: (isPwaInstalled: boolean) => void;
    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => void;
    setIsSwUpdateAvailable: (isSwUpdateAvailable: boolean) => void;
    callPWAInstall: () => Promise<void>;
}

const initialPWAStore = {
    isPwaInstalled: checkIsPwaInstalled(),
    isPwaInstallable: checkIsPwaInstallable(),
    pwaInstallPrompt: null,
    isSwUpdateAvailable: false,
};

export const usePwaStore = create<PwaStore>((set, get) => ({
    ...initialPWAStore,

    setIsPwaInstallable: (isPwaInstallable: boolean) => {
        set({ isPwaInstallable });
    },

    setIsPwaInstalled: (isPwaInstalled: boolean) => {
        set({ isPwaInstalled });
    },

    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => {
        set({ pwaInstallPrompt });
    },

    setIsSwUpdateAvailable: (isSwUpdateAvailable: boolean) => {
        set({ isSwUpdateAvailable });
    },

    callPWAInstall: async () => {
        const { pwaInstallPrompt } = get();

        if (!pwaInstallPrompt) {
            return;
        }

        pwaInstallPrompt.prompt();

        const { outcome } = await pwaInstallPrompt.userChoice;

        if (outcome === 'accepted') {
            set({ isPwaInstalled: true, isPwaInstallable: false, pwaInstallPrompt: null });
            toast.success(i18n.t('toasts:pwa.installing'));
        }
    },
}));
