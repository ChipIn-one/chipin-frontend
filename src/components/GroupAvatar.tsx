import { LucideUsers } from 'lucide-react';
import { ApiGroup } from 'types/api';

import { Avatar } from '@radix-ui/themes';

interface Props {
    group: ApiGroup;
}

const GroupAvatar = ({ group }: Props) => {
    return (
        <Avatar
            size="4"
            src={group.groupImg}
            alt={group.name}
            fallback={group.emoji || <LucideUsers />}
        />
    );
};

export default GroupAvatar;
