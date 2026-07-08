import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Text } from '@radix-ui/themes';

import type { FriendCurrencyGroup } from 'store/usersSelectors';

import DebtAmount from 'basics/DebtAmount';

import FriendListItem from './FriendListItem';

const CurrencyGroupCard = ({ currency, netBalance, friends }: FriendCurrencyGroup) => {
    const { t } = useTranslation('common');
    const isOwed = netBalance >= 0;

    return (
        <Card>
            <Flex justify="between" align="center" mb="3">
                <Flex align="center" gap="2">
                    <Text weight="bold" size="3" color={isOwed ? 'green' : 'red'}>
                        {currency}
                    </Text>
                    <Text size="2" color="gray">
                        {isOwed ? t('balances.youAreOwed') : t('balances.youOwe')}
                    </Text>
                </Flex>

                <DebtAmount amount={netBalance} currency={currency} weight="bold" size="3" />
            </Flex>

            <Flex direction="column" gap="3">
                {friends.map(({ friend, balance }, index) => (
                    <Flex key={friend.user.id} direction="column" gap="3">
                        {index === 0 && <Separator size="4" />}
                        <FriendListItem
                            friend={friend}
                            balance={balance}
                        />
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default CurrencyGroupCard;
