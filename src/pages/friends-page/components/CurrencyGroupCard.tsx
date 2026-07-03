import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Text } from '@radix-ui/themes';

import type { UnsettledFriends } from 'api/chipin.types';

import DebtAmount from 'basics/DebtAmount';

import FriendListItem from './FriendListItem';

interface Props extends UnsettledFriends {
    friendCurrencyBalances: Record<string, { currency: string; amount: number }[]>;
}

const CurrencyGroupCard = ({ currency, netBalance, friends, friendCurrencyBalances }: Props) => {
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
                {friends.map((item, index) => (
                    <Flex key={item.user.id} direction="column" gap="3">
                        {index === 0 && <Separator size="4" />}
                        <FriendListItem
                            friend={item.user}
                            netAmount={item.amount}
                            currency={currency}
                            currencyBalances={friendCurrencyBalances[item.user.id] ?? []}
                        />
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default CurrencyGroupCard;
