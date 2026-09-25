import { useEffect, useRef, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useCopyToClipboard, useNetworkState } from '@uidotdev/usehooks';

import type { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { detectNativeShare, shareGroupInvite } from 'helpers/share';
import { buildGroupInviteLink } from 'helpers/url';
import { usePwaStore } from 'store/pwaStore';

const INVITE_FEEDBACK_DELAY_MS = 1.5 * SECOND;
const CONNECTION_RESTORED_TOAST_DURATION = 4 * SECOND;

export const useCheckOnlineStatus = () => {
    const { online } = useNetworkState();
    const previousOnline = useRef<boolean | undefined>(undefined);

    useEffect(() => {
        if (online === undefined) {
            return;
        }

        const previousOnlineValue = previousOnline.current;
        previousOnline.current = online;

        if (previousOnlineValue === undefined || previousOnlineValue === online) {
            return;
        }

        if (online === false) {
            toast.warning(i18n.t('toasts:common.disconnect'), {
                id: TOASTS_IDS.connectionStatus,
                description: i18n.t('toasts:common.disconnectDescription'),
                duration: Infinity,
            });
            return;
        }

        toast.success(i18n.t('toasts:common.reconnected'), {
            description: null,
            duration: CONNECTION_RESTORED_TOAST_DURATION,
            icon: null,
            id: TOASTS_IDS.connectionStatus,
        });
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
    const isMounted = useRef(true);
    const shareFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const inviteLink = buildGroupInviteLink({ inviteToken: group.inviteToken });
    const isNativeShareSupported = detectNativeShare();

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;

            if (shareFeedbackTimer.current !== null) {
                clearTimeout(shareFeedbackTimer.current);
                shareFeedbackTimer.current = null;
            }

            if (copyFeedbackTimer.current !== null) {
                clearTimeout(copyFeedbackTimer.current);
                copyFeedbackTimer.current = null;
            }
        };
    }, []);

    const handleShare = (shareTitle: string): Promise<void> => {
        return shareGroupInvite({ url: inviteLink, title: shareTitle }).then(result => {
            if (result !== 'shared' || !isMounted.current) {
                return;
            }

            setIsShareDone(true);

            if (shareFeedbackTimer.current !== null) {
                clearTimeout(shareFeedbackTimer.current);
            }

            shareFeedbackTimer.current = setTimeout(() => {
                setIsShareDone(false);
                shareFeedbackTimer.current = null;
            }, INVITE_FEEDBACK_DELAY_MS);
        });
    };

    const handleCopyLink = (): Promise<void> => {
        return copyFn(inviteLink).then(() => {
            if (!isMounted.current) {
                return;
            }

            setIsCopied(true);

            if (copyFeedbackTimer.current !== null) {
                clearTimeout(copyFeedbackTimer.current);
            }

            copyFeedbackTimer.current = setTimeout(() => {
                setIsCopied(false);
                copyFeedbackTimer.current = null;
            }, INVITE_FEEDBACK_DELAY_MS);
        });
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
