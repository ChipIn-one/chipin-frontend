import { ComponentProps } from 'react';
import { LucideUser } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

import { useUsersStore } from 'store/usersStore';

type AvatarSize = ComponentProps<typeof Avatar>['size'];
type AvatarSrc = ComponentProps<typeof Avatar>['src'];
type AvatarFallback = ComponentProps<typeof Avatar>['fallback'];

interface Props {
    size?: AvatarSize;
    src?: AvatarSrc;
    fallback?: AvatarFallback;
}

const UserAvatar = ({ size = '3', src, fallback }: Props) => {
    const { user } = useUsersStore();

    return (
        <Avatar
            variant="soft"
            size={size}
            color="mint"
            radius="full"
            src={src || user?.picture || ''}
            fallback={fallback || user?.displayName.charAt(0) || <LucideUser size={20} />}
        />
    );
};

export default UserAvatar;
