import { SummaryDebtCards } from 'components/summary-debt-cards';

import { useConnect } from './internal/group-summary';

interface Props {
    isLoading: boolean;
}

const GroupSummary = ({ isLoading }: Props) => {
    const {
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        defaultCurrency,
    } = useConnect();

    return (
        <SummaryDebtCards
            isLoading={isLoading}
            owedToYouTotal={owedTotalInBase}
            youOweTotal={owingTotalInBase}
            owedEntries={owedEntries}
            oweEntries={oweEntries}
            defaultCurrency={defaultCurrency}
        />
    );
};

export default GroupSummary;
