import styled from 'styled-components';
import { ApiUser } from 'types/api';

import { Avatar, Text } from '@radix-ui/themes';

export const Row = styled.div`
    display: flex;
    align-items: center;
`;

export const AvatarWrapper = styled.div<{ index: number }>`
    margin-left: ${({ index }) => (index === 0 ? 0 : '-4px')};
    z-index: ${({ index }) => 10 - index};
`;

export const ExtraAvatarWrapper = styled.div`
    margin-left: -4px;
    z-index: 0;
`;

interface Props {
    members: ApiUser[];
    max?: number;
}
const UsersRow = ({ members, max = 5 }: Props) => {
    const visibleUsers = members.slice(0, max);
    const hiddenCount = members.length - max;

    return (
        <Row>
            {visibleUsers.map((user, index) => (
                <AvatarWrapper key={user.id} index={index}>
                    <Avatar
                        size="1"
                        radius="full"
                        src={user.picture || ''}
                        alt={user.displayName}
                        fallback={user.displayName?.[0]}
                    />
                </AvatarWrapper>
            ))}

            {hiddenCount > 0 && (
                <ExtraAvatarWrapper>
                    <Avatar
                        size="1"
                        color="cyan"
                        radius="full"
                        fallback={<Text size="1" weight="bold" as="span">{`+${hiddenCount}`}</Text>}
                    />
                </ExtraAvatarWrapper>
            )}
        </Row>
    );
};

export default UsersRow;
