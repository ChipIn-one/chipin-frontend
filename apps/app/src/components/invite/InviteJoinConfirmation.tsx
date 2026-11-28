import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { CircleAlertIcon, type LucideIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { useIsMobile } from 'hooks/common';
import type { InviteConfirmationStatus } from 'hooks/useInviteConfirmation';

import { OnlineOnly } from 'components/online-only';

type InviteJoinVariant = 'group' | 'friend';

interface Props {
    /** Which invite this is: picks the icon tile. */
    variant: InviteJoinVariant;
    status: InviteConfirmationStatus;
    errorMessage?: string;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    retryLabel: string;
    invalidTitle: string;
    invalidDescription: string;
    goHomeLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

interface IconTile {
    Icon: LucideIcon;
    color: ComponentProps<typeof Avatar>['color'];
}

// Decorative tiles through `PROP_COLOR`; the friend tile is the accent, matching the DS EmptyState
// tile of friends (`NoFriendsEmptyState`).
const ICON_TILES: Record<InviteJoinVariant | 'invalid', IconTile> = {
    group: { Icon: UsersIcon, color: PROP_COLOR.success },
    friend: { Icon: UserPlusIcon, color: PROP_COLOR.accent },
    invalid: { Icon: CircleAlertIcon, color: PROP_COLOR.neutral },
};

// The primary button never gets autoFocus: Enter or a double tap right after the
// screen opens must not join before the user has read it.
const InviteJoinConfirmation = ({
    variant,
    status,
    errorMessage,
    title,
    description,
    confirmLabel,
    cancelLabel,
    retryLabel,
    invalidTitle,
    invalidDescription,
    goHomeLabel,
    onConfirm,
    onCancel,
}: Props) => {
    const isMobile = useIsMobile();
    const isInvalid = status === 'invalid';
    const isError = status === 'error';
    const { Icon, color: iconColor } = ICON_TILES[isInvalid ? 'invalid' : variant];
    const buttonSize = isMobile ? '3' : '2';

    const content = (
        <Flex direction="column" gap="4">
            {/* Decorative: Radix `Avatar` passes extra props to its image, so the wrapper hides it. */}
            <Flex aria-hidden>
                <Avatar
                    size={isMobile ? '5' : '4'}
                    variant="soft"
                    color={iconColor}
                    fallback={<Icon size={isMobile ? 24 : 20} />}
                />
            </Flex>
            <Heading as="h1" size={isMobile ? '6' : '5'}>
                {isInvalid ? invalidTitle : title}
            </Heading>
            <Text as="p" size={isMobile ? '3' : '2'} color={PROP_COLOR.neutral}>
                {isInvalid ? invalidDescription : description}
            </Text>
            {isError && (
                <Text as="p" size={isMobile ? '3' : '2'} color={PROP_COLOR.danger} role="alert">
                    {errorMessage}
                </Text>
            )}
        </Flex>
    );

    // The DOM order is secondary, then primary (Cancel, Join at the end of the card row); the phone
    // column is reversed, so there the full-width primary sits above the secondary.
    const actions = (
        <Flex
            direction={isMobile ? 'column-reverse' : 'row'}
            justify="end"
            gap="3"
            wrap={isMobile ? 'nowrap' : 'wrap'}
            data-invite-join-actions
        >
            {isInvalid ? (
                <Button type="button" size={buttonSize} onClick={onCancel}>
                    {goHomeLabel}
                </Button>
            ) : (
                <>
                    <Button
                        type="button"
                        size={buttonSize}
                        variant="soft"
                        color={PROP_COLOR.neutral}
                        onClick={onCancel}
                    >
                        {isError ? goHomeLabel : cancelLabel}
                    </Button>
                    <OnlineOnly action={ONLINE_ONLY_ACTIONS.inviteAccept} isFullWidth={isMobile}>
                        <Box width={isMobile ? '100%' : undefined} asChild>
                            <Button
                                type="button"
                                size={buttonSize}
                                loading={status === 'joining' || status === 'waiting'}
                                onClick={onConfirm}
                            >
                                {isError ? retryLabel : confirmLabel}
                            </Button>
                        </Box>
                    </OnlineOnly>
                </>
            )}
        </Flex>
    );

    // Phone: no card. The page grows into the free height of `BareLayout` (a flex column below the
    // header, the offline banner included), the content is centred in it, the actions at the bottom.
    if (isMobile) {
        return (
            <Flex
                direction="column"
                flexGrow="1"
                gap="5"
                pt="4"
                pb="2"
                data-invite-join-layout="phone"
            >
                <Flex direction="column" justify="center" flexGrow="1">
                    {content}
                </Flex>
                {actions}
            </Flex>
        );
    }

    return (
        <Flex justify="center" px="4" pt="6" data-invite-join-layout="card">
            <Box width="100%" maxWidth="480px">
                <Card size="3">
                    <Flex direction="column" gap="4">
                        {content}
                        {actions}
                    </Flex>
                </Card>
            </Box>
        </Flex>
    );
};

export { InviteJoinConfirmation };
export type { InviteJoinVariant };
