import { toast } from 'sonner';
import { create } from 'zustand';

import { MESSAGES } from 'constants/messages';
import { checkCanPwaBeInstalled } from 'helpers/pwa';

interface PwaStore {
    isPwaCanBeInstalled: boolean;
    pwaInstallPrompt: BeforeInstallPromptEvent | null;
    setIsPwaCanBeInstalled: (isPwaCanBeInstalled: boolean) => void;
    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => void;
    callPWAInstall: () => Promise<void>;
}

const initialPWAStore = {
    isPwaCanBeInstalled: checkCanPwaBeInstalled(),
    pwaInstallPrompt: null,
};

export const usePwaStore = create<PwaStore>((set, get) => ({
    ...initialPWAStore,

    setIsPwaCanBeInstalled: (isInstalled: boolean) => {
        set({ isPwaCanBeInstalled: isInstalled });
    },

    setPwaInstallPrompt: (pwaInstallPrompt: BeforeInstallPromptEvent | null) => {
        set({ pwaInstallPrompt });
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
            toast.success(MESSAGES.success.pwa.INSTALLING);
        }
    },
}));
