import { useEffect } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useUsersStore } from 'store/users-store';

const useFriendInviteLink = () => {
    const navigate = useNavigate();
    const { inviteToken } = useParams<{ inviteToken: string }>();
    const acceptFriendInvite = useUsersStore(state => state.acceptFriendInvite);

    useEffect(() => {
        if (!inviteToken) {
            return;
        }

        let isActive = true;
        const authSessionVersion = getAuthSessionVersion();
        const isCurrent = () => (
            isActive && isAuthSessionCurrent(authSessionVersion)
        );

        acceptFriendInvite({ inviteToken })
            .then(friend => {
                if (!isCurrent()) {
                    return;
                }

                const friendName = friend.displayName.trim();

                toast.success(
                    friendName
                        ? i18n.t('toasts:friend.inviteAcceptedWithName', { name: friendName })
                        : i18n.t('toasts:friend.inviteAccepted'),
                );
                navigate(ROUTES.FRIENDS, { replace: true });
            })
            .catch((error: unknown) => {
                if (!isCurrent()) {
                    return;
                }

                toast.error(resolveApiErrorMessageFromError(
                    error,
                    i18n.t('toasts:friend.inviteJoinError'),
                ));
            });

        return () => {
            isActive = false;
        };
    }, [acceptFriendInvite, inviteToken, navigate]);
};

export { useFriendInviteLink };
