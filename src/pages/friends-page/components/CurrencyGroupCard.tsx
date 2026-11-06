import { Card, Flex, Separator, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { balanceDirection, legacyAmountFromMoney } from 'entities/balance';
import type { FriendCurrencyGroup } from 'entities/users';

import DebtAmount from 'basics/DebtAmount';

import FriendListItem from './FriendListItem';

const CurrencyGroupCard = ({ currency, net, friends }: FriendCurrencyGroup) => {
    const { t } = useTranslation('common');
    const direction = balanceDirection(net);
    const color = direction === 'settled' ? 'gray' : direction === 'owed' ? 'green' : 'red';
    const directionLabel =
        direction === 'settled'
            ? t('balances.settledUp')
            : t(direction === 'owed' ? 'balances.youAreOwed' : 'balances.youOwe');

    return (
        <Card>
            <Flex justify="between" align="center" mb="3">
                <Flex align="center" gap="2">
                    <Text weight="bold" size="3" color={color}>
                        {currency}
                    </Text>
                    <Text size="2" color="gray">
                        {directionLabel}
                    </Text>
                </Flex>

                <DebtAmount
                    amount={legacyAmountFromMoney(net)}
                    currency={currency}
                    weight="bold"
                    size="3"
                />
            </Flex>

            <Flex direction="column" gap="3">
                {friends.map(({ friend, balance }, index) => (
                    <Flex key={friend.user.id} direction="column" gap="3">
                        {index === 0 && <Separator size="4" />}
                        <FriendListItem friend={friend} balance={balance} />
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default CurrencyGroupCard;
