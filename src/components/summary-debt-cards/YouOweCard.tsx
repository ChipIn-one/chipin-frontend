import { BalanceBadges } from 'basics';
import Big from 'bignumber.js';
import { LucideTrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { BalanceEntry } from 'helpers/currencies';

import { Amount } from 'basics/numbers';

interface Props {
    isLoading: boolean;
    total: Big;
    mainCurrency: string;
    entries: BalanceEntry[];
}

const YouOweCard: React.FC<Props> = ({ isLoading, total, mainCurrency, entries }) => {
    const { t } = useTranslation('dashboard');

    const badgeItems = entries.map(entry => ({
        tokenCode: entry.currency,
        value: entry.totalOwing,
        color: 'tomato' as const,
    }));

    return (
        <Card>
            <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                        <Skeleton loading={isLoading}>
                            <Avatar
                                size="2"
                                color="tomato"
                                fallback={<LucideTrendingDown size={16} />}
                            />
                        </Skeleton>

                        <Skeleton loading={isLoading}>
                            <Text color="tomato" size="4" weight="medium">
                                {t('summary.youOwe')}
                            </Text>
                        </Skeleton>
                    </Flex>

                    <Skeleton loading={isLoading} width="80px">
                        <Text size="4" color="tomato" weight="bold">
                            <Amount value={total} tokenCode={mainCurrency} precision={0} />
                        </Text>
                    </Skeleton>
                </Flex>

                <BalanceBadges items={badgeItems} isLoading={isLoading} />
            </Flex>
        </Card>
    );
};

export default YouOweCard;
