import { useCallback } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { useUsersStore } from 'store/users-store';

import { type InviteConfirmationState, useInviteConfirmation } from './useInviteConfirmation';

const useFriendInviteLink = (): InviteConfirmationState => {
    const navigate = useNavigate();
    const { inviteToken } = useParams<{ inviteToken: string }>();
    const acceptFriendInvite = useUsersStore(state => state.acceptFriendInvite);

    const onAccept = useCallback(
        (token: string) => acceptFriendInvite({ inviteToken: token }),
        [acceptFriendInvite],
    );
    const onAccepted = useCallback(({ displayName }: { displayName: string }) => {
        const friendName = displayName.trim();

        toast.success(
            friendName
                ? i18n.t('toasts:friend.inviteAcceptedWithName', { name: friendName })
                : i18n.t('toasts:friend.inviteAccepted'),
        );
        navigate(ROUTES.FRIENDS, { replace: true });
    }, [navigate]);

    return useInviteConfirmation({
        inviteToken,
        errorFallbackMessage: i18n.t('toasts:friend.inviteJoinError'),
        onAccept,
        onAccepted,
    });
};

export { useFriendInviteLink };
