import { BalanceBadges } from 'basics';
import Big from 'bignumber.js';
import { LucideTrendingUp } from 'lucide-react';
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

const OwedToYouCard: React.FC<Props> = ({ isLoading, total, mainCurrency, entries }) => {
    const { t } = useTranslation('dashboard');

    const badgeItems = entries.map(entry => ({
        tokenCode: entry.currency,
        value: entry.totalOwed,
        color: 'grass' as const,
    }));

    return (
        <Card>
            <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                        <Skeleton loading={isLoading}>
                            <Avatar
                                size="1"
                                color="grass"
                                fallback={<LucideTrendingUp size={16} />}
                            />
                        </Skeleton>

                        <Skeleton loading={isLoading}>
                            <Text color="grass" weight="medium">
                                {t('summary.owedToYou')}
                            </Text>
                        </Skeleton>
                    </Flex>

                    <Skeleton loading={isLoading} width="80px">
                        <Text size={{ initial: '3', sm: '4' }} color="grass" weight="bold">
                            <Amount value={total} tokenCode={mainCurrency} precision={0} />
                        </Text>
                    </Skeleton>
                </Flex>

                <BalanceBadges items={badgeItems} isLoading={isLoading} />
            </Flex>
        </Card>
    );
};

export default OwedToYouCard;
