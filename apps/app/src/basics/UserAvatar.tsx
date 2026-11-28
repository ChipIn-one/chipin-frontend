import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Skeleton } from '@radix-ui/themes';
import { UserIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

interface UserLike {
    displayName: string;
    picture?: string | null;
}

// The accessible name lives on the avatar root, so `UserAvatar` owns these attributes.
type OwnedAvatarProps =
    'fallback' | 'asChild' | 'children' | 'role' | 'aria-label' | 'aria-labelledby' | 'aria-hidden';

interface Props extends Omit<ComponentProps<typeof Avatar>, OwnedAvatarProps> {
    user?: UserLike;
    isLoading?: boolean;
    /**
     * Hides the avatar from assistive technology. Use it when the user's name is visible next to
     * the avatar (a list row, a select item), so a screen reader does not hear the name twice.
     */
    decorative?: boolean;
}

/**
 * The user's photo, or the first letter of the name (an icon without a user). The root is one
 * `role="img"` named by `alt` (the user's `displayName` by default) in every state, photo or
 * fallback; `decorative` (or no name at all) hides it from assistive technology instead.
 */
const UserAvatar = ({
    size = '3',
    user,
    isLoading,
    decorative = false,
    alt,
    src = user?.picture || '',
    variant = 'soft',
    color = PROP_COLOR.accent,
    radius = 'full',
    ...avatarProps
}: Props) => {
    const label = alt ?? user?.displayName ?? '';
    const isHidden = decorative || !label;

    const AvatarNode = (
        <Avatar
            {...avatarProps}
            asChild
            // The root carries the name; the photo inside it adds nothing to announce.
            alt=""
            variant={variant}
            size={size}
            color={color}
            radius={radius}
            src={src}
            fallback={user?.displayName.charAt(0) || <UserIcon size={20} />}
        >
            {isHidden ? <span aria-hidden="true" /> : <span role="img" aria-label={label} />}
        </Avatar>
    );

    return isLoading ? <Skeleton loading={isLoading}>{AvatarNode}</Skeleton> : AvatarNode;
};

export { UserAvatar };
