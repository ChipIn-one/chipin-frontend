import { BalanceBadges } from 'basics';
import { LucideTrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { BalanceEntry } from 'api/chipin.raw.types';

import { Amount } from 'basics/numbers';

interface Props {
    isLoading: boolean;
    total: number | null;
    defaultCurrency: string;
    entries: BalanceEntry[];
}

const YouOweCard: React.FC<Props> = ({ isLoading, total, defaultCurrency, entries }) => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');

    if (!entries.length && !isLoading) {
        return null;
    }

    const badgeItems = entries.map(entry => ({
        tokenCode: entry.currency,
        value: Math.abs(entry.netBalance || 0),
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

                        <Text color="tomato" size="4" weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('summary.youOwe')}
                            </Skeleton>
                        </Text>
                    </Flex>

                    <Text size="4" color="tomato" weight="bold">
                        <Skeleton loading={isLoading}>
                            {isLoading ? (
                                tSkeletons('debtAmount.amount')
                            ) : (
                                <Amount value={total} tokenCode={defaultCurrency} precision={0} />
                            )}
                        </Skeleton>
                    </Text>
                </Flex>

                <BalanceBadges items={badgeItems} isLoading={isLoading} />
            </Flex>
        </Card>
    );
};

export default YouOweCard;
