import type { Group } from 'entities/groups';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteOnboarding } from 'components/invite-onboarding';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const invite = useGroupInvite(group);

    return <InviteOnboarding invite={invite} />;
};

export default GroupInviteEmptyState;
