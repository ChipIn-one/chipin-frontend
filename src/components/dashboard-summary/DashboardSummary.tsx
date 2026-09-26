import { Flex } from '@radix-ui/themes';

import SummaryDebtCards from '../summary-debt-cards/SummaryDebtCards';
import TotalBalanceCard from '../summary-debt-cards/TotalBalanceCard';

import { useConnect } from './internal';

interface Props {
    isLoading?: boolean;
}

const DashBoardSummary = ({ isLoading = false }: Props) => {
    const {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        defaultCurrency,
    } = useConnect();

    return (
        <Flex direction="column" gap="4">
            <TotalBalanceCard
                isLoading={isLoading}
                netTotalInBase={netTotalInBase}
                defaultCurrency={defaultCurrency}
            />

            <SummaryDebtCards
                isLoading={isLoading}
                owedToYouTotal={owedTotalInBase}
                youOweTotal={owingTotalInBase}
                owedEntries={owedEntries}
                oweEntries={oweEntries}
                defaultCurrency={defaultCurrency}
            />
        </Flex>
    );
};

export default DashBoardSummary;
