import { useShallow } from 'zustand/react/shallow';

import { useGroupsStore } from 'store/groupsStore';
import { selectUserCurrency } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import { SummaryDebtCards } from 'components/summary-debt-cards';

interface Props {
    isLoading: boolean;
}

const GroupSummary = ({ isLoading }: Props) => {
    const { owedTotalInBase, owingTotalInBase, owedEntries, oweEntries } = useGroupsStore(
        useShallow(state => ({
            owedTotalInBase: state.owedTotalInBase,
            owingTotalInBase: state.owingTotalInBase,
            owedEntries: state.owedEntries,
            oweEntries: state.oweEntries,
        })),
    );
    const defaultCurrency = useUsersStore(selectUserCurrency);

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
