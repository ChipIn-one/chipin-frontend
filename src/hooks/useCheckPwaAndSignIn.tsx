import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { checkAndRemoveExpiredToken } from 'store/IDB/auth';
import { usePwaStore } from 'store/pwaStore';

export const useCheckPwaAndSignIn = () => {
    const navigate = useNavigate();

    const { setIsAuthChecked } = useAuthStore();
    const { setIsPwaCanBeInstalled, setPwaInstallPrompt } = usePwaStore();

    const setPwaInstalledToState = () => {
        setIsPwaCanBeInstalled(true);
    };

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
        setPwaInstallPrompt(e);
    };

    useEffect(() => {
        checkAndRemoveExpiredToken()
            .then(isValid => {
                if (!isValid) {
                    navigate(ROUTES.HOME);
                    setIsAuthChecked(false);
                } else {
                    setIsAuthChecked(true);
                }
            })
            .catch(() => {
                navigate(ROUTES.HOME);
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
