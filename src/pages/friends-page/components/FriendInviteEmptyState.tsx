import { useFriendInvite } from 'hooks/pwaHooks';
import { useUsersStore } from 'store/users-store';

import { InviteEmptyState } from 'components/invite';

const FriendInviteEmptyState = () => {
    const inviteToken = useUsersStore(state => state.user?.inviteToken);
    const invite = useFriendInvite(inviteToken ?? '');

    if (!inviteToken) {
        return null;
    }

    return <InviteEmptyState invite={invite} />;
};

export default FriendInviteEmptyState;
