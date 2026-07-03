import { Flex, Text } from '@radix-ui/themes';

import type { User } from 'api/chipin.types';

import DebtAmount from 'basics/DebtAmount';
import UserAvatar from 'basics/UserAvatar';

import FriendActionsDropdown from './FriendActionsDropdown';

interface Props {
    friend: User;
    netAmount: number;
    currency: string;
    currencyBalances: { currency: string; amount: number }[];
}

const FriendListItem = ({ friend, netAmount, currency, currencyBalances }: Props) => {
    return (
        <Flex justify="between" align="center">
            <Flex align="center" gap="3">
                <UserAvatar user={friend} size={{ initial: '1', sm: '2' }} />
                <Text as="span" weight="medium" size={{ initial: '2', sm: '3' }}>
                    {friend.displayName}
                </Text>
            </Flex>
            <Flex align="center" gap="4">
                <DebtAmount amount={netAmount} currency={currency} weight="medium" size="2" />
                <FriendActionsDropdown
                    friend={friend}
                    initialCurrency={currency}
                    currencyBalances={currencyBalances}
                />
            </Flex>
        </Flex>
    );
};

export default FriendListItem;
