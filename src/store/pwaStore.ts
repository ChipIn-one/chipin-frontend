import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import { checkCanPwaBeInstalled } from 'helpers/pwa';

interface PwaStore {
    isPwaCanBeInstalled: boolean;
    pwaInstallPrompt: BeforeInstallPromptEvent | null;
    isSwUpdateAvailable: boolean;
    setIsPwaCanBeInstalled: (isPwaCanBeInstalled: boolean) => void;
    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => void;
    setIsSwUpdateAvailable: (isSwUpdateAvailable: boolean) => void;
    callPWAInstall: () => Promise<void>;
}

const initialPWAStore = {
    isPwaCanBeInstalled: checkCanPwaBeInstalled(),
    pwaInstallPrompt: null,
    isSwUpdateAvailable: false,
};

export const usePwaStore = create<PwaStore>((set, get) => ({
    ...initialPWAStore,

    setIsPwaCanBeInstalled: (isInstalled: boolean) => {
        set({ isPwaCanBeInstalled: isInstalled });
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
            set({ isPwaCanBeInstalled: false, pwaInstallPrompt: null });
            toast.success(i18n.t('toasts:pwa.installing'));
        }
    },
}));
