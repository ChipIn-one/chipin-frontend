import { useEffect } from 'react';

import { useAuthStore } from 'store/authStore';
import { checkAndRemoveExpiredToken } from 'store/IDB/auth';
import { usePwaStore } from 'store/pwaStore';

export const useCheckPwaAndSignIn = () => {
    const { setIsAuthChecked } = useAuthStore();
    const { setIsPwaCanBeInstalled, setPwaInstallPrompt } = usePwaStore();

    const setPwaInstalledToState = () => {
        setIsPwaCanBeInstalled(true);
    };

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
        setPwaInstallPrompt(e);
    };

    useEffect(() => {
        //TODO: add redirect to dexie, save user default page and redireact after login
        checkAndRemoveExpiredToken()
            .then(isValid => {
                if (!isValid) {
                    setIsAuthChecked(false);
                } else {
                    setIsAuthChecked(true);
                }
            })
            .catch(() => {
                setIsAuthChecked(false);
            });

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', setPwaInstalledToState);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', setPwaInstalledToState);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};
