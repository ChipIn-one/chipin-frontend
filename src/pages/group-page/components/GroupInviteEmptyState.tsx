import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteEmptyState } from 'components/invite';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    return <InviteEmptyState invite={useGroupInvite(group)} />;
};

export default GroupInviteEmptyState;
