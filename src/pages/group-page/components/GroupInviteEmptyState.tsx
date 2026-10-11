import type { Group } from 'api/chipin.types';
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
