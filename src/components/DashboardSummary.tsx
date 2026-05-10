import { useShallow } from 'zustand/react/shallow';

import { Flex } from '@radix-ui/themes';

import { getCurrencySummary } from 'helpers/currencies';
import {
    selectBalances,
    selectCurrencyRates,
    selectDefaultCurrency,
    selectOwedEntries,
    selectOweEntries,
} from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

import TotalBalanceCard from './dashboard-summary/TotalBalanceCard';
import SummaryDebtCards from './SummaryDebtCards';

interface Props {
    isLoading?: boolean;
}

const DashBoardSummary: React.FC<Props> = ({ isLoading = false }) => {
    const balances = useDashboardStore(selectBalances);
    const rates = useDashboardStore(selectCurrencyRates);
    const mainCurrency = useDashboardStore(selectDefaultCurrency);
    const owedEntries = useDashboardStore(useShallow(selectOwedEntries));
    const oweEntries = useDashboardStore(useShallow(selectOweEntries));

    const { netTotal, owedTotal, owingTotal } = getCurrencySummary(balances, rates, mainCurrency);

    return (
        <Flex direction="column" gap="4">
            <TotalBalanceCard
                isLoading={isLoading}
                netTotal={netTotal}
                mainCurrency={mainCurrency}
            />

            <SummaryDebtCards
                isLoading={isLoading}
                owedToYouTotal={owedTotal}
                youOweTotal={owingTotal}
                owedEntries={owedEntries}
                oweEntries={oweEntries}
                mainCurrency={mainCurrency}
            />
        </Flex>
    );
};

export default DashBoardSummary;
