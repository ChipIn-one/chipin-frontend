import type { Group } from 'api/chipin.types';
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
