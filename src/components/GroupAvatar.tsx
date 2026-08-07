import { LucideUsers } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';

interface Props {
    group: Pick<Group, 'coverUrl' | 'name'>;
    variant?: React.ComponentProps<typeof Avatar>['variant'];
    size?: React.ComponentProps<typeof Avatar>['size'];
    color?: React.ComponentProps<typeof Avatar>['color'];
}

const GroupAvatar = ({ group, variant = 'soft', size = '4', color = 'green' }: Props) => {
    return (
        <Avatar
            variant={variant}
            size={size}
            src={group.coverUrl ?? undefined}
            alt={group.name}
            color={color}
            fallback={<LucideUsers />}
        />
    );
};

export default GroupAvatar;
