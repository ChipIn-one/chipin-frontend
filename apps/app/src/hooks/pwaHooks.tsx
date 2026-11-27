import { useEffect, useRef, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { SECOND } from 'constants/time';
import type { Group } from 'entities/groups';
import { copyTextToClipboard } from 'helpers/clipboard';
import { detectNativeShare, type InviteShareContent, shareInvite } from 'helpers/share';
import { buildFriendInviteLink, buildGroupInviteLink } from 'helpers/url';
import { usePwaStore } from 'store/pwaStore';

const INVITE_FEEDBACK_DELAY_MS = 1.5 * SECOND;
// The Copy link retry toast stays longer than the default so the user can reach its action.
const INVITE_COPY_RETRY_TOAST_DURATION_MS = 10 * SECOND;

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
    copyRetryLabel: string;
    shareContent: InviteShareContent;
    qr: InviteQrContent;
}

const useInvite = ({
    inviteLink,
    copySuccessMessage,
    copyErrorMessage,
    copyRetryLabel,
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

    const showCopyError = (canRetry: boolean): void => {
        if (!canRetry) {
            toast.error(copyErrorMessage);
            return;
        }

        // A failed copy (or a failed share sheet) has used up the user activation, so the retry
        // needs a fresh click: the toast action copies again inside that click.
        toast.error(copyErrorMessage, {
            duration: INVITE_COPY_RETRY_TOAST_DURATION_MS,
            action: {
                label: copyRetryLabel,
                onClick: () => {
                    void retryCopyFromToast();
                },
            },
        });
    };

    const retryCopyFromToast = (): Promise<void> => {
        return copyTextToClipboard(inviteLink).then(result => {
            if (result !== 'copied') {
                showCopyError(false);
                return;
            }

            if (!isMounted.current) {
                toast.success(copySuccessMessage);
                return;
            }

            showCopiedFeedback();
        });
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
                showCopyError(true);
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
                showCopyError(true);
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
        copyRetryLabel: i18n.t('toasts:common.copyLinkAction'),
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
        copyRetryLabel: i18n.t('toasts:common.copyLinkAction'),
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
