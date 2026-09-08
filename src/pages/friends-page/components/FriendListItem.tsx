import { Flex, Text } from '@radix-ui/themes';

import type { FriendBalance, KnownUser } from 'api/chipin.types';

import DebtAmount from 'basics/DebtAmount';
import UserAvatar from 'basics/UserAvatar';

import FriendActionsDropdown from './FriendActionsDropdown';

interface Props {
    friend: KnownUser;
    balance: FriendBalance;
}

const FriendListItem = ({ friend, balance }: Props) => {
    return (
        <Flex justify="between" align="center">
            <Flex align="center" gap="3">
                <UserAvatar user={friend.user} size={{ initial: '1', sm: '2' }} />
                <Text as="span" weight="medium" size={{ initial: '2', sm: '3' }}>
                    {friend.user.displayName}
                </Text>
            </Flex>
            <Flex align="center" gap="4">
                <DebtAmount
                    amount={balance.netAmount}
                    currency={balance.currency}
                    weight="medium"
                    size="2"
                />
                <FriendActionsDropdown
                    friend={friend}
                    balance={balance}
                />
            </Flex>
        </Flex>
    );
};

export default FriendListItem;
