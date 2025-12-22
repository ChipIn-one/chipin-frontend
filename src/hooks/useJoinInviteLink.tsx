import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { inviteApiUserToGroup } from 'api/chipin';
import { MESSAGES } from 'constants/messages';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

export const useJoinInviteLink = () => {
    const navigate = useNavigate();

    const { isLoggedIn } = useAuthStore.getState();

    const { inviteToken } = useParams<{ inviteToken: string }>();

    if (inviteToken && isLoggedIn) {
        inviteApiUserToGroup({ inviteToken })
            .then(({ groupId, groupName }) => {
                console.log(groupId);
                navigate(`${ROUTES.GROUP}/${groupId}`, { replace: true });
                // TODO: ADD GROUP NAME TO TOAST (NEED BACK)
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
