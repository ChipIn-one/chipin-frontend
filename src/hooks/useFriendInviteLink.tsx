import { useEffect, useRef } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useUsersStore } from 'store/users-store';

const useFriendInviteLink = () => {
    const navigate = useNavigate();
    const { inviteToken } = useParams<{ inviteToken: string }>();
    const acceptFriendInvite = useUsersStore(state => state.acceptFriendInvite);
    const startedToken = useRef<string | null>(null);

    useEffect(() => {
        if (!inviteToken || startedToken.current === inviteToken) {
            return;
        }

        startedToken.current = inviteToken;

        acceptFriendInvite({ inviteToken })
            .then(friend => {
                const friendName = friend.displayName.trim();

                toast.success(
                    friendName
                        ? i18n.t('toasts:friend.inviteAcceptedWithName', { name: friendName })
                        : i18n.t('toasts:friend.inviteAccepted'),
                );
                navigate(ROUTES.FRIENDS, { replace: true });
            })
            .catch((error: unknown) => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    i18n.t('toasts:friend.inviteJoinError'),
                ));
            });
    }, [acceptFriendInvite, inviteToken, navigate]);
};

export { useFriendInviteLink };
