import { useCallback } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';

import { type InviteConfirmationState, useInviteConfirmation } from './useInviteConfirmation';
import { useAcceptFriendInvite } from './useUserMutations';

const useFriendInviteLink = (): InviteConfirmationState => {
    const navigate = useNavigate();
    const { inviteToken } = useParams<{ inviteToken: string }>();
    const onAccept = useAcceptFriendInvite();
    const onAccepted = useCallback(
        ({ displayName }: { displayName: string }) => {
            const friendName = displayName.trim();

            toast.success(
                friendName
                    ? i18n.t('toasts:friend.inviteAcceptedWithName', { name: friendName })
                    : i18n.t('toasts:friend.inviteAccepted'),
            );
            void navigate(ROUTES.FRIENDS, { replace: true });
        },
        [navigate],
    );

    return useInviteConfirmation({
        inviteToken,
        errorFallbackMessage: i18n.t('toasts:friend.inviteJoinError'),
        onAccept,
        onAccepted,
    });
};

export { useFriendInviteLink };
