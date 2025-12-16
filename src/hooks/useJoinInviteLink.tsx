import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { URL_PARAMS } from 'constants/url';
import { useGroupStore } from 'store/groupStore';

export const useJoinInviteLink = () => {
    const { inviteToGroup } = useGroupStore();

    // const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get(URL_PARAMS.inviteToken);

    useEffect(() => {
        if (inviteToken) {
            inviteToGroup({ inviteToken });
            // navigate(`/groups/${groupId}`, { replace: true });
        }
        //TODO: Add redirect to joinded group page
    }, [inviteToken, inviteToGroup]);
};
