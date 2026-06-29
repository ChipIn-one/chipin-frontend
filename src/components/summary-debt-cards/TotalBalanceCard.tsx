import { useTranslation } from 'react-i18next';

import { Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import DebtAmount from 'basics/DebtAmount';

interface Props {
    isLoading: boolean;
    netTotalInBase: number | null;
    defaultCurrency: string;
}

const TotalBalanceCard: React.FC<Props> = ({ isLoading, netTotalInBase, defaultCurrency }) => {
    const { t } = useTranslation('dashboard');

    return (
        <Card size="1">
            <Flex direction="column" gap="1">
                <Text size="4" weight="medium" color="gray" as="span">
                    <Skeleton loading={isLoading}>
                        {t('summary.totalBalance')}
                    </Skeleton>
                </Text>

                <DebtAmount
                    isLoading={isLoading}
                    amount={netTotalInBase || 0}
                    currency={defaultCurrency}
                    size="7"
                    weight="bold"
                />

                <Text size="2" color="gray" as="span">
                    <Skeleton loading={isLoading}>
                        {t('summary.totalAcrossGroupsAndFriends')}
                    </Skeleton>
                </Text>
            </Flex>
        </Card>
    );
};

export default TotalBalanceCard;
