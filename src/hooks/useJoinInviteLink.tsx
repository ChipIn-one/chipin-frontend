import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { inviteApiUserToGroup } from 'api/chipin';
import { MESSAGES } from 'constants/messages';
import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

export const useJoinInviteLink = () => {
    const navigate = useNavigate();

    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    const { inviteToken } = useParams<{ inviteToken: string }>();

    if (inviteToken && isLoggedIn) {
        inviteApiUserToGroup({ inviteToken })
            .then(({ groupId, groupName }) => {
                navigate(`${ROUTES.GROUP}/${groupId}`, { replace: true });
                toast.success(MESSAGES.success.group.INVITE_JOIN(groupName));
            })
            .catch(e => {
                console.error(e);
                toast.error(MESSAGES.error.group.INVITE_JOIN);
            });
    } else if (inviteToken && !isLoggedIn) {
        toast.warning(MESSAGES.warning.group.INVITE_JOIN);
    }
};
