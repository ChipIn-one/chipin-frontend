import { Flex } from '@radix-ui/themes';

import SummaryDebtCards from '../summary-debt-cards/SummaryDebtCards';
import TotalBalanceCard from '../summary-debt-cards/TotalBalanceCard';

import { useConnect } from './internal';

interface Props {
    isLoading?: boolean;
    hasGroups?: boolean;
}

const DashBoardSummary = ({
    isLoading = false,
    hasGroups = false,
}: Props) => {
    const {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        defaultCurrency,
    } = useConnect();
    const hasDebtEntries =
        owedEntries.length > 0 || oweEntries.length > 0;
    const showTotalBalance =
        isLoading ||
        (netTotalInBase !== null && netTotalInBase !== 0);

    if (
        !isLoading &&
        !showTotalBalance &&
        !hasDebtEntries &&
        !hasGroups
    ) {
        return null;
    }

    return (
        <Flex direction="column" gap="4">
            {showTotalBalance && (
                <TotalBalanceCard
                    isLoading={isLoading}
                    netTotalInBase={netTotalInBase}
                    defaultCurrency={defaultCurrency}
                />
            )}

            <SummaryDebtCards
                isLoading={isLoading}
                owedToYouTotal={owedTotalInBase}
                youOweTotal={owingTotalInBase}
                owedEntries={owedEntries}
                oweEntries={oweEntries}
                defaultCurrency={defaultCurrency}
                showSettledEmptyState={hasGroups}
            />
        </Flex>
    );
};

export default DashBoardSummary;
