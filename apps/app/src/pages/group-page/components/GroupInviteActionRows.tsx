import type { Group } from 'entities/groups';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteActionRows } from 'components/invite';

interface Props {
    group: Group;
}

const GroupInviteActionRows = ({ group }: Props) => {
    const invite = useGroupInvite(group);

    return <InviteActionRows invite={invite} />;
};

export default GroupInviteActionRows;
