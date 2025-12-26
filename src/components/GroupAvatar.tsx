import { LucideUsers } from 'lucide-react';

import { Avatar, Text } from '@radix-ui/themes';

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
            fallback={group.emoji ? <Text size="7">{group.emoji}</Text> : <LucideUsers />}
        />
    );
};

export default GroupAvatar;
