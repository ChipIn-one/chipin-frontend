import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Text } from '@radix-ui/themes';

import type { ApiUserResponse } from 'api/chipin.types';

import DebtAmount from 'basics/DebtAmount';

import FriendListItem from './FriendListItem';

export interface CurrencyGroupItem {
    user: ApiUserResponse;
    netAmount: number;
}

interface Props {
    currency: string;
    netTotal: number;
    items: CurrencyGroupItem[];
}

const CurrencyGroupCard = ({ currency, netTotal, items }: Props) => {
    const { t } = useTranslation('common');
    const isOwed = netTotal >= 0;

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

                <DebtAmount amount={netTotal} currency={currency} weight="bold" size="3" />
            </Flex>

            <Flex direction="column" gap="3">
                {items.map((item, index) => (
                    <Flex key={item.user.id} direction="column" gap="3">
                        {index === 0 && <Separator size="4" />}
                        <FriendListItem
                            picture={item.user.picture}
                            displayName={item.user.displayName}
                            netAmount={item.netAmount}
                            currency={currency}
                        />
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default CurrencyGroupCard;
