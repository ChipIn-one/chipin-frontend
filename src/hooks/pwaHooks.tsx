import { useEffect } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';

import { Spinner } from '@radix-ui/themes';
import { useNetworkState } from '@uidotdev/usehooks';

import { TOASTS_IDS } from 'constants/toasts';
import { usePwaStore } from 'store/pwaStore';

export const useCheckOnlineStatus = () => {
    const { online } = useNetworkState();

    useEffect(() => {
        // Fired when connection is lost
        if (!online) {
            toast.warning(i18n.t('toasts:common.disconnect'), {
                id: TOASTS_IDS.connectionStatus,
                icon: <Spinner size="1" />,
                description: i18n.t('toasts:common.disconnectDescription'),
                duration: Infinity,
            });
        } else {
            toast.dismiss(TOASTS_IDS.connectionStatus);
            toast.success(i18n.t('toasts:common.reconnected'));
        }
    }, [online]);
};

export const useCheckPwa = () => {
    const { setIsPwaCanBeInstalled, setPwaInstallPrompt } = usePwaStore();

    const setPwaInstalledToState = () => {
        setIsPwaCanBeInstalled(true);
    };

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
        setPwaInstallPrompt(e);
    };

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', setPwaInstalledToState);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', setPwaInstalledToState);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};
