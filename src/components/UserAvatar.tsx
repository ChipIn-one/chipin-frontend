import { ComponentProps } from 'react';
import { LucideUser } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

import { useUsersStore } from 'store/usersStore';

type AvatarSize = ComponentProps<typeof Avatar>['size'];

interface Props {
    size?: AvatarSize;
}

const UserAvatar = ({ size = '3' }: Props) => {
    const { user } = useUsersStore();

    return (
        <Avatar
            variant="soft"
            size={size}
            color="mint"
            radius="full"
            src={user?.picture || ''}
            fallback={user?.displayName.charAt(0) || <LucideUser size={20} />}
        />
    );
};

export default UserAvatar;
