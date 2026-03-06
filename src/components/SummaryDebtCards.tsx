import { LucideTrendingDown, LucideTrendingUp } from 'lucide-react';

import { Avatar, Card, Flex, Grid, Skeleton, Text } from '@radix-ui/themes';

import { Amount } from 'basics/numbers';

interface Props {
    isLoading?: boolean;
    positiveBalances: number;
    negativeBalances: number;
}

const SummaryDebtCards: React.FC<Props> = ({
    isLoading = false,
    positiveBalances,
    negativeBalances,
}) => {
    const currencyPrefix = '$';

    return (
        <Grid columns="2" gap="4">
            <Card>
                <Flex direction="column" gap="2">
                    <Flex direction="row" align="center" gap="2">
                        <Skeleton loading={isLoading}>
                            <Avatar
                                size="1"
                                color="grass"
                                fallback={<LucideTrendingUp size={16} />}
                            />
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text color="grass" size="3" weight="medium">
                                Owed to you
                            </Text>
                        </Skeleton>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <Text size="6" color="grass" weight="bold" as="p">
                            <Amount
                                value={positiveBalances}
                                customPrefix={currencyPrefix}
                                precision={2}
                            />
                        </Text>
                    </Skeleton>
                </Flex>
            </Card>

            <Card>
                <Flex direction="column" gap="2">
                    <Flex direction="row" align="center" gap="2">
                        <Skeleton loading={isLoading}>
                            <Avatar
                                size="1"
                                color="tomato"
                                fallback={<LucideTrendingDown size={16} />}
                            />
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text color="tomato" size="3" weight="medium">
                                You owe
                            </Text>
                        </Skeleton>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <Text size="6" color="tomato" weight="bold" as="p">
                            <Amount
                                value={negativeBalances}
                                customPrefix={currencyPrefix}
                                precision={2}
                            />
                        </Text>
                    </Skeleton>
                </Flex>
            </Card>
        </Grid>
    );
};

export default SummaryDebtCards;
