import { useEffect, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { Spinner } from '@radix-ui/themes';
import { useCopyToClipboard, useNetworkState } from '@uidotdev/usehooks';

import { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { detectNativeShare, shareGroupInvite } from 'helpers/share';
import { buildGroupInviteLink } from 'helpers/url';
import { usePwaStore } from 'store/pwaStore';

const INVITE_FEEDBACK_DELAY_MS = 1.5 * SECOND;
const CONNECTION_RESTORED_TOAST_DURATION = 4 * SECOND;

export const useCheckOnlineStatus = () => {
    const { online } = useNetworkState();

    useEffect(() => {
        if (online === false) {
            toast.warning(i18n.t('toasts:common.disconnect'), {
                id: TOASTS_IDS.connectionStatus,
                icon: <Spinner size="1" />,
                description: i18n.t('toasts:common.disconnectDescription'),
                duration: Infinity,
            });
        } else if (online === true) {
            toast.success(i18n.t('toasts:common.reconnected'), {
                description: null,
                duration: CONNECTION_RESTORED_TOAST_DURATION,
                icon: null,
                id: TOASTS_IDS.connectionStatus,
            });
        }
    }, [online]);
};

export const useCheckPwa = () => {
    const { setIsPwaInstalled, setPwaInstallPrompt } = usePwaStore(
        useShallow(state => ({
            setIsPwaInstalled: state.setIsPwaInstalled,
            setPwaInstallPrompt: state.setPwaInstallPrompt,
        })),
    );

    const onAppInstalled = () => {
        setIsPwaInstalled(true);
        setPwaInstallPrompt(null);
    };

    const onBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
        e.preventDefault();
        setPwaInstallPrompt(e);
    };

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
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
