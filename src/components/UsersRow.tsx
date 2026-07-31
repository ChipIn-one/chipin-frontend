import styled from 'styled-components';

import { Avatar, Flex, Text } from '@radix-ui/themes';

import type { GroupUser } from 'api/chipin.types';

// Flex paints items in order-modified order, so the reverse layout keeps both DOM and visual user order intact.
export const AvatarWrapper = styled.div<{ $stackOrder: number }>`
    order: ${({ $stackOrder }) => -$stackOrder};
`;

interface Props {
    members: GroupUser[];
    max?: number;
    size?: React.ComponentProps<typeof Avatar>['size'];
}

const UsersRow = ({ members, size = '1', max = 5 }: Props) => {
    const visibleUsers = members.slice(0, max);
    const hiddenCount = members.length - max;

    return (
        <Flex align="center" direction="row-reverse" justify="end">
            {visibleUsers.map((user, index) => (
                <AvatarWrapper key={user.id} $stackOrder={index}>
                    <Avatar
                        mr="-1"
                        size={size}
                        radius="full"
                        src={user.picture || ''}
                        alt={user.displayName}
                        fallback={user.displayName?.[0]}
                    />
                </AvatarWrapper>
            ))}

            {hiddenCount > 0 && (
                <AvatarWrapper $stackOrder={visibleUsers.length}>
                    <Avatar
                        mr="-1"
                        size="1"
                        color="cyan"
                        radius="full"
                        // eslint-disable-next-line react/jsx-no-literals
                        fallback={<Text size="1" weight="bold" as="span">{`+${hiddenCount}`}</Text>}
                    />
                </AvatarWrapper>
            )}
        </Flex>
    );
};

export default UsersRow;
