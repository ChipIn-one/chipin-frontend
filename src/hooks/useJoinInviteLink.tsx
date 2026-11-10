import { useCallback } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

import { useJoinGroup } from './useGroupMutations';
import { type InviteConfirmationState, useInviteConfirmation } from './useInviteConfirmation';

export const useJoinInviteLink = (): InviteConfirmationState => {
    const navigate = useNavigate();
    const joinGroup = useJoinGroup();
    const { inviteToken } = useParams<{ inviteToken: string }>();

    const onAccept = useCallback((token: string) => joinGroup(token), [joinGroup]);
    const onAccepted = useCallback(
        ({ id }: { id: string }) => {
            void navigate(`${ROUTES.GROUP}/${id}`, { replace: true });
        },
        [navigate],
    );

    return useInviteConfirmation({
        inviteToken,
        errorFallbackMessage: i18n.t('toasts:group.inviteJoinError'),
        onAccept,
        onAccepted,
    });
};
