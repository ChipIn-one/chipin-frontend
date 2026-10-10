import { useFriendInvite } from 'hooks/pwaHooks';
import { useUsersStore } from 'store/users-store';

import { InviteOnboarding } from 'components/invite-onboarding';

const FriendInviteEmptyState = () => {
    const inviteToken = useUsersStore(state => state.user?.inviteToken);
    const invite = useFriendInvite(inviteToken ?? '');

    if (!inviteToken) {
        return null;
    }

    return <InviteOnboarding invite={invite} />;
};

export default FriendInviteEmptyState;
