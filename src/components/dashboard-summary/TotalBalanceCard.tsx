import Big from 'bignumber.js';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { Amount } from 'basics/numbers';

interface Props {
    isLoading: boolean;
    netTotal: Big;
    mainCurrency: string;
}

const TotalBalanceCard: React.FC<Props> = ({ isLoading, netTotal, mainCurrency }) => {
    const { t } = useTranslation('dashboard');
    const balanceColor = netTotal.gte(0) ? 'grass' : 'tomato';

    return (
        <Card size="1">
            <Flex direction="column" gap="1">
                <Skeleton loading={isLoading} width="140px">
                    <Text size="3" weight="medium" color="gray" as="span">
                        {t('summary.totalBalance')}
                    </Text>
                </Skeleton>

                <Skeleton loading={isLoading} width="170px">
                    <Text
                        size={{ initial: '5', sm: '7' }}
                        color={balanceColor}
                        weight="bold"
                        as="span"
                    >
                        <Amount value={netTotal} tokenCode={mainCurrency} />
                    </Text>
                </Skeleton>

                <Skeleton loading={isLoading} width="150px" height="var(--space-4)">
                    <Text size={{ initial: '1', sm: '2' }} color="gray" as="span">
                        {t('summary.totalAcrossGroupsAndFriends')}
                    </Text>
                </Skeleton>
            </Flex>
        </Card>
    );
};

export default TotalBalanceCard;
