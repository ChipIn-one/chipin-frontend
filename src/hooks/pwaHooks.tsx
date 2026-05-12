import { useEffect, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';

import { Spinner } from '@radix-ui/themes';
import { useCopyToClipboard, useNetworkState } from '@uidotdev/usehooks';

import { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { detectNativeShare, shareGroupInvite } from 'helpers/share';
import { buildGroupInviteLink } from 'helpers/url';
import { usePwaStore } from 'store/pwaStore';

const INVITE_FEEDBACK_DELAY_MS = 1.5 * SECOND;

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

interface UseGroupInviteResult {
    inviteLink: string;
    isNativeShareSupported: boolean;
    isShareDone: boolean;
    isCopied: boolean;
    handleShare: (shareTitle: string) => Promise<void>;
    handleCopyLink: () => Promise<void>;
}

export const useGroupInvite = (group: Group): UseGroupInviteResult => {
    const [isShareDone, setIsShareDone] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [, copyFn] = useCopyToClipboard();

    const inviteLink = buildGroupInviteLink({ inviteToken: group.inviteToken });
    const isNativeShareSupported = detectNativeShare();

    const handleShare = async (shareTitle: string) => {
        const result = await shareGroupInvite({ url: inviteLink, title: shareTitle });

        if (result === 'shared') {
            setIsShareDone(true);
            setTimeout(() => setIsShareDone(false), INVITE_FEEDBACK_DELAY_MS);
        }
    };

    const handleCopyLink = async () => {
        await copyFn(inviteLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), INVITE_FEEDBACK_DELAY_MS);
    };

    return {
        inviteLink,
        isNativeShareSupported,
        isShareDone,
        isCopied,
        handleShare,
        handleCopyLink,
    };
};
