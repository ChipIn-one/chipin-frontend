import { LucideUser } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Avatar, Skeleton } from '@radix-ui/themes';

interface UserLike {
    displayName: string;
    picture?: string | null;
}

interface Props extends Omit<ComponentProps<typeof Avatar>, 'fallback'> {
    user?: UserLike;
    isLoading?: boolean;
}

const UserAvatar = ({
    size = '3',
    user,
    isLoading,
    src = user?.picture || '',
    variant = 'soft',
    color = 'mint',
    radius = 'full',
    ...avatarProps
}: Props) => {
    const AvatarNode = (
        <Avatar
            {...avatarProps}
            variant={variant}
            size={size}
            color={color}
            radius={radius}
            src={src}
            fallback={user?.displayName.charAt(0) || <LucideUser size={20} />}
        />
    );

    return isLoading ? <Skeleton loading={isLoading}>{AvatarNode}</Skeleton> : AvatarNode;
};

export default UserAvatar;
