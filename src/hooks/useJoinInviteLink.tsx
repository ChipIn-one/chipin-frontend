import { useCallback } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';

import { type InviteConfirmationState, useInviteConfirmation } from './useInviteConfirmation';

export const useJoinInviteLink = (): InviteConfirmationState => {
    const navigate = useNavigate();
    const { joinGroup } = useGroupsStore();
    const { inviteToken } = useParams<{ inviteToken: string }>();

    const onAccept = useCallback(
        (token: string) => joinGroup({ inviteToken: token }),
        [joinGroup],
    );
    const onAccepted = useCallback(({ id }: { id: string }) => {
        navigate(`${ROUTES.GROUP}/${id}`, { replace: true });
    }, [navigate]);

    return useInviteConfirmation({
        inviteToken,
        errorFallbackMessage: i18n.t('toasts:group.inviteJoinError'),
        onAccept,
        onAccepted,
    });
};
