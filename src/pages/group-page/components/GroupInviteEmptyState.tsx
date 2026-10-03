import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteEmptyState } from 'components/invite';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const invite = useGroupInvite(group);

    return <InviteEmptyState invite={invite} />;
};

export default GroupInviteEmptyState;
