import { ComponentProps } from 'react';
import { LucideUser } from 'lucide-react';

import { Avatar, Skeleton } from '@radix-ui/themes';

type AvatarSize = ComponentProps<typeof Avatar>['size'];

interface UserLike {
    displayName: string;
    picture: string | null;
}

interface Props {
    user?: UserLike;
    size?: AvatarSize;
    isLoading?: boolean;
}

const UserAvatar = ({ size = '3', user, isLoading }: Props) => {
    const AvatarNode = (
        <Avatar
            variant="soft"
            size={size}
            color="mint"
            radius="full"
            src={user?.picture || ''}
            fallback={user?.displayName.charAt(0) || <LucideUser size={20} />}
        />
    );

    return isLoading ? <Skeleton loading={isLoading}>{AvatarNode}</Skeleton> : AvatarNode;
};

export default UserAvatar;
