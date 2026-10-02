import { useEffect, useRef, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useNetworkState } from '@uidotdev/usehooks';

import type { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { copyTextToClipboard } from 'helpers/clipboard';
import {
    detectNativeShare,
    type InviteShareContent,
    shareInvite,
} from 'helpers/share';
import { buildFriendInviteLink, buildGroupInviteLink } from 'helpers/url';
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

export interface InviteQrContent {
    title: string;
    accessibleDescription: string;
    description: string;
    subtitle: string;
}

export interface UseInviteResult {
    inviteLink: string;
    isNativeShareSupported: boolean;
    isShareDone: boolean;
    isCopied: boolean;
    qr: InviteQrContent;
    onShare: () => Promise<void>;
    onCopyLink: () => Promise<void>;
}

interface UseInviteParams {
    inviteLink: string;
    copySuccessMessage: string;
    copyErrorMessage: string;
    shareContent: InviteShareContent;
    qr: InviteQrContent;
}

const useInvite = ({
    inviteLink,
    copySuccessMessage,
    copyErrorMessage,
    shareContent,
    qr,
}: UseInviteParams): UseInviteResult => {
    const [isShareDone, setIsShareDone] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const isMounted = useRef(true);
    const shareFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const showCopiedFeedback = (): void => {
        toast.success(copySuccessMessage);
        setIsCopied(true);

        if (copyFeedbackTimer.current !== null) {
            clearTimeout(copyFeedbackTimer.current);
        }

        copyFeedbackTimer.current = setTimeout(() => {
            setIsCopied(false);
            copyFeedbackTimer.current = null;
        }, INVITE_FEEDBACK_DELAY_MS);
    };

    const onShare = (): Promise<void> => {
        return shareInvite({
            url: inviteLink,
            title: shareContent.title,
            text: shareContent.text,
        }).then(result => {
            if (!isMounted.current) {
                return;
            }

            if (result === 'copied') {
                showCopiedFeedback();
                return;
            }

            if (result === 'unsupported') {
                toast.error(copyErrorMessage);
                return;
            }

            if (result !== 'shared') {
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

    const onCopyLink = (): Promise<void> => {
        return copyTextToClipboard(inviteLink).then(result => {
            if (!isMounted.current) {
                return;
            }

            if (result !== 'copied') {
                toast.error(copyErrorMessage);
                return;
            }

            showCopiedFeedback();
        });
    };

    return {
        inviteLink,
        isNativeShareSupported,
        isShareDone,
        isCopied,
        qr,
        onShare,
        onCopyLink,
    };
};

export const useGroupInvite = (group: Group): UseInviteResult => {
    return useInvite({
        inviteLink: buildGroupInviteLink({ inviteToken: group.inviteToken }),
        copySuccessMessage: i18n.t('toasts:group.inviteLinkCopied'),
        copyErrorMessage: i18n.t('toasts:group.inviteLinkCopyError'),
        shareContent: {
            title: i18n.t('group:qr.shareTitle', { groupName: group.name }),
            text: i18n.t('group:qr.shareText', { groupName: group.name }),
        },
        qr: {
            title: i18n.t('group:qr.title'),
            accessibleDescription: i18n.t('group:qr.description'),
            description: i18n.t('group:qr.joinDescription', {
                groupName: group.name,
            }),
            subtitle: i18n.t('group:page.settings.showQRSubtitle'),
        },
    });
};

export const useFriendInvite = (inviteToken: string): UseInviteResult => {
    return useInvite({
        inviteLink: buildFriendInviteLink({ inviteToken }),
        copySuccessMessage: i18n.t('toasts:friend.inviteLinkCopied'),
        copyErrorMessage: i18n.t('toasts:friend.inviteLinkCopyError'),
        shareContent: {
            title: i18n.t('friends:invite.shareTitle'),
            text: i18n.t('friends:invite.shareText'),
        },
        qr: {
            title: i18n.t('friends:invite.qrTitle'),
            accessibleDescription: i18n.t('friends:invite.qrDescription'),
            description: i18n.t('friends:invite.qrJoinDescription'),
            subtitle: i18n.t('friends:invite.showQRSubtitle'),
        },
    });
};
