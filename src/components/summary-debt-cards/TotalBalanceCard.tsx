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
                <Skeleton loading={isLoading} width="140px">
                    <Text size="4" weight="medium" color="gray" as="span">
                        {t('summary.totalBalance')}
                    </Text>
                </Skeleton>

                <DebtAmount
                    isLoading={isLoading}
                    amount={netTotalInBase || 0}
                    currency={defaultCurrency}
                    size="7"
                    weight="bold"
                />

                <Skeleton loading={isLoading} width="150px" height="var(--space-4)">
                    <Text size="2" color="gray" as="span">
                        {t('summary.totalAcrossGroupsAndFriends')}
                    </Text>
                </Skeleton>
            </Flex>
        </Card>
    );
};

export default TotalBalanceCard;
