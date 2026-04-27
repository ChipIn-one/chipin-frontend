import { useEffect } from 'react';
import i18n from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useGroupsStore } from 'store/groupsStore';

export const useJoinInviteLink = () => {
    const navigate = useNavigate();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const { joinGroup } = useGroupsStore();
    const { inviteToken } = useParams<{ inviteToken: string }>();

    useEffect(() => {
        if (!inviteToken) {
            return;
        }

        if (!isLoggedIn) {
            toast.warning(i18n.t('toasts:group.inviteJoinWarning'));
            return;
        }

        joinGroup({ inviteToken })
            .then(({ id }) => {
                navigate(`${ROUTES.GROUP}/${id}`, { replace: true });
            })
            .catch(() => {
                toast.error(i18n.t('toasts:group.inviteJoinError'));
            });
    }, [inviteToken, isLoggedIn, joinGroup, navigate]);
};
