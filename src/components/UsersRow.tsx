import styled from 'styled-components';
import { ApiUser } from 'types/api';

import { Avatar, Flex, Text } from '@radix-ui/themes';

export const AvatarWrapper = styled.div<{ index: number }>`
    position: relative;
    z-index: ${({ index }) => 10 - index};
`;

interface Props {
    members: ApiUser[];
    max?: number;
}

const UsersRow = ({ members, max = 5 }: Props) => {
    const visibleUsers = members.slice(0, max);
    const hiddenCount = members.length - max;

    return (
        <Flex align="center">
            {visibleUsers.map((user, index) => (
                <AvatarWrapper key={user.id} index={index}>
                    <Avatar
                        mr="-1"
                        size="1"
                        radius="full"
                        src={user.picture || ''}
                        alt={user.displayName}
                        fallback={user.displayName?.[0]}
                    />
                </AvatarWrapper>
            ))}

            {hiddenCount > 0 && (
                <Avatar
                    mr="-1"
                    size="1"
                    color="cyan"
                    radius="full"
                    fallback={<Text size="1" weight="bold" as="span">{`+${hiddenCount}`}</Text>}
                />
            )}
        </Flex>
    );
};

export default UsersRow;
