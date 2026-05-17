import { BalanceBadges } from 'basics';
import { LucideTrendingUp } from 'lucide-react';
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

const OwedToYouCard: React.FC<Props> = ({ isLoading, total, defaultCurrency, entries }) => {
    const { t } = useTranslation('dashboard');

    if (!entries.length && !isLoading) {
        return null;
    }

    const badgeItems = entries.map(entry => ({
        tokenCode: entry.currency,
        value: entry.netBalance || 0,
        color: 'grass' as const,
    }));

    return (
        <Card>
            <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                        <Skeleton loading={isLoading}>
                            <Avatar
                                size="2"
                                color="grass"
                                fallback={<LucideTrendingUp size={16} />}
                            />
                        </Skeleton>

                        <Skeleton loading={isLoading}>
                            <Text color="grass" weight="medium" size="4">
                                {t('summary.owedToYou')}
                            </Text>
                        </Skeleton>
                    </Flex>

                    <Skeleton loading={isLoading} width="80px">
                        <Text size="4" color="grass" weight="bold">
                            <Amount value={total} tokenCode={defaultCurrency} precision={0} />
                        </Text>
                    </Skeleton>
                </Flex>

                <BalanceBadges items={badgeItems} isLoading={isLoading} />
            </Flex>
        </Card>
    );
};

export default OwedToYouCard;
