import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Text } from '@radix-ui/themes';

import { BalanceEntry } from 'api/chipin.raw.types';
import type { ApiUserResponse } from 'api/chipin.types';

import { Amount } from 'basics/numbers';

import FriendListItem from './FriendListItem';

export interface CurrencyGroupItem {
    user: ApiUserResponse;
    balances: BalanceEntry[];
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
                <Text weight="medium" size="3" color={isOwed ? 'green' : 'red'}>
                    {isOwed ? '+' : '-'}
                    <Amount value={Math.abs(netTotal)} tokenCode={currency} precision={0} />
                </Text>
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
