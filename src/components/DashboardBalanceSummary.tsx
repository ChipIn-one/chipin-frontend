import { LucideTrendingDown, LucideTrendingUp } from 'lucide-react';

import { Avatar, Card, Flex, Grid, Skeleton, Text } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';

interface DashboardBalanceSummaryProps {
    isLoading?: boolean;
}

const DashboardBalanceSummary: React.FC<DashboardBalanceSummaryProps> = ({ isLoading = false }) => {
    const { groups } = useGroupsStore();
    const totalBalance = 285.8;
    const owedToYou = 337.2;
    const youOwe = 51.4;
    const currencyPrefix = '$';
    const balanceColor = totalBalance >= 0 ? 'grass' : 'tomato';

    return (
        <Flex direction="column" gap="4">
            <Card size="4">
                <Flex direction="column" gap="3">
                    <Skeleton loading={isLoading} width="140px">
                        <Text size="4" weight="medium" as="p">
                            Total balance
                        </Text>
                    </Skeleton>

                    <Skeleton loading={isLoading} width="170px">
                        <Text size="7" color={balanceColor} weight="bold" as="p">
                            <Amount value={totalBalance} customPrefix={currencyPrefix} />
                        </Text>
                    </Skeleton>

                    <Skeleton loading={isLoading} width="170px">
                        <Text size="4" color="gray" as="p">
                            across {groups.length} groups
                        </Text>
                    </Skeleton>
                </Flex>
            </Card>

            <Grid columns="2" gap="4">
                <Card>
                    <Flex direction="column" gap="2">
                        <Flex direction="row" align="center" gap="2">
                            <Avatar
                                size="1"
                                color="grass"
                                fallback={<LucideTrendingUp size={16} />}
                            />
                            <Text color="grass" size="3" weight="medium">
                                Owed to you
                            </Text>
                        </Flex>

                        <Skeleton loading={isLoading} width="120px">
                            <Text size="6" color="grass" weight="bold" as="p">
                                <Amount value={owedToYou} customPrefix={currencyPrefix} />
                            </Text>
                        </Skeleton>
                    </Flex>
                </Card>

                <Card>
                    <Flex direction="column" gap="2">
                        <Flex direction="row" align="center" gap="2">
                            <Avatar
                                size="1"
                                color="tomato"
                                fallback={<LucideTrendingDown size={16} />}
                            />
                            <Text color="tomato" size="3" weight="medium">
                                You owe
                            </Text>
                        </Flex>

                        <Skeleton loading={isLoading} width="100px">
                            <Text size="6" color="tomato" weight="bold" as="p">
                                <Amount value={youOwe} customPrefix={currencyPrefix} />
                            </Text>
                        </Skeleton>
                    </Flex>
                </Card>
            </Grid>
        </Flex>
    );
};

export default DashboardBalanceSummary;
