import { Avatar, Flex, Text } from '@radix-ui/themes';

import DebtAmount from 'basics/DebtAmount';

import FriendActionsDropdown from './FriendActionsDropdown';

interface Props {
    friendId: string;
    picture: string | null;
    displayName: string;
    netAmount: number;
    currency: string;
}

const FriendListItem = ({ friendId, picture, displayName, netAmount, currency }: Props) => {
    return (
        <Flex justify="between" align="center">
            <Flex align="center" gap="3">
                <Avatar
                    src={picture || ''}
                    fallback={displayName.charAt(0)}
                    size={{ initial: '1', sm: '2' }}
                    radius="full"
                />
                <Text as="span" weight="medium" size={{ initial: '2', sm: '3' }}>
                    {displayName}
                </Text>
            </Flex>
            <Flex align="center" gap="4">
                <DebtAmount amount={netAmount} currency={currency} weight="medium" size="2" />
                <FriendActionsDropdown friendId={friendId} />
            </Flex>
        </Flex>
    );
};

export default FriendListItem;
