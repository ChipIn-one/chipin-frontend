import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { MESSAGES } from 'constants/messages';
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
            toast.warning(MESSAGES.warning.group.INVITE_JOIN);
            return;
        }

        joinGroup({ inviteToken })
            .then(({ groupId, groupName }) => {
                navigate(`${ROUTES.GROUP}/${groupId}`, { replace: true });
                toast.success(MESSAGES.success.group.INVITE_JOIN(groupName));
            })
            .catch(() => {
                toast.error(MESSAGES.error.group.INVITE_JOIN);
            });
    }, [inviteToken, isLoggedIn, joinGroup, navigate]);
};
