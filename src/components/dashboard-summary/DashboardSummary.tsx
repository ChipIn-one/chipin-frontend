import { useEffect } from 'react';

import { Flex } from '@radix-ui/themes';

import { useDashboardStore } from 'store/dashboardStore';
import { selectUserCurrency } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import SummaryDebtCards from '../summary-debt-cards/SummaryDebtCards';
import TotalBalanceCard from '../summary-debt-cards/TotalBalanceCard';

interface Props {
    isLoading?: boolean;
}

const DashBoardSummary: React.FC<Props> = ({ isLoading = false }) => {
    const defaultCurrency = useUsersStore(selectUserCurrency);
    const {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        setDashboardSummaryCurrency,
    } = useDashboardStore();

    useEffect(() => {
        setDashboardSummaryCurrency(defaultCurrency);
    }, [defaultCurrency, setDashboardSummaryCurrency]);

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
