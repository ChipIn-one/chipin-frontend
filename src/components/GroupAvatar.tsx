import { LucideUsers } from 'lucide-react';

import { Avatar, Text } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';

interface Props {
    group: Pick<Group, 'coverUrl' | 'emoji' | 'name'>;
    variant?: React.ComponentProps<typeof Avatar>['variant'];
    size?: React.ComponentProps<typeof Avatar>['size'];
    color?: React.ComponentProps<typeof Avatar>['color'];
}

const GroupAvatar = ({ group, variant = 'soft', size = '4', color = 'green' }: Props) => {
    const emojiSize =
        Number(size) + 3 > 9
            ? '9'
            : ((Number(size) + 3).toString() as `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`);

    return (
        <Avatar
            variant={variant}
            size={size}
            src={group.coverUrl || ''}
            alt={group.name}
            color={color}
            fallback={group.emoji ? <Text size={emojiSize}>{group.emoji}</Text> : <LucideUsers />}
        />
    );
};

export default GroupAvatar;
