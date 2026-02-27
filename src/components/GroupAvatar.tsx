import { LucideUsers } from 'lucide-react';

import { Avatar, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';

interface Props {
    group: ApiGroup;
    size?: React.ComponentProps<typeof Avatar>['size'];
}

const GroupAvatar = ({ group, size = '4' }: Props) => {
    const emojiSize =
        Number(size) + 3 > 9
            ? '9'
            : ((Number(size) + 3).toString() as `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`);

    return (
        <Avatar
            size={size}
            src={group.coverUrl || ''}
            alt={group.name}
            fallback={group.emoji ? <Text size={emojiSize}>{group.emoji}</Text> : <LucideUsers />}
        />
    );
};

export default GroupAvatar;
