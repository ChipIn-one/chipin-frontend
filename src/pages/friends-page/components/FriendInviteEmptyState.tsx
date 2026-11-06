import { useFriendInvite } from 'hooks/pwaHooks';
import { useSelfUser } from 'hooks/useSelfUser';

import { InviteOnboarding } from 'components/invite-onboarding';

const FriendInviteEmptyState = () => {
    const inviteToken = useSelfUser()?.inviteToken;
    const invite = useFriendInvite(inviteToken ?? '');

    if (!inviteToken) {
        return null;
    }

    return <InviteOnboarding invite={invite} />;
};

export default FriendInviteEmptyState;
