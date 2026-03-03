import { Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';

import SummaryDebtCards from './SummaryDebtCards';

interface Props {
    isLoading?: boolean;
}

const DashBoardSummary: React.FC<Props> = ({ isLoading = false }) => {
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

            <SummaryDebtCards
                isLoading={isLoading}
                positiveBalances={owedToYou}
                negativeBalances={youOwe}
            />
        </Flex>
    );
};

export default DashBoardSummary;
