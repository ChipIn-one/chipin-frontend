import { LucideUsers } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';

interface Props {
    group: ApiGroup;
}

const GroupAvatar = ({ group }: Props) => {
    return (
        <Avatar
            size="4"
            src={group.coverUrl || ''}
            alt={group.name}
            fallback={group.emoji || <LucideUsers />}
        />
    );
};

export default GroupAvatar;
