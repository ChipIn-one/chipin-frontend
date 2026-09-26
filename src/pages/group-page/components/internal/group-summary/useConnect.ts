import { useDashboardStore } from 'store/dashboardStore';
import { calcGroupSummary, selectGroupBalances } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';
import { selectUserCurrency, useUsersStore } from 'store/users-store';

const EMPTY_GROUP_SUMMARY: ReturnType<typeof calcGroupSummary> = {
    owedTotalInBase: 0,
    owingTotalInBase: 0,
    netTotalInBase: 0,
    owedEntries: [],
    oweEntries: [],
};

const useConnect = () => {
    const selectedGroup = useGroupsStore(state => state.selectedGroup);
    const currencies = useDashboardStore(state => state.currencies);
    const defaultCurrency = useUsersStore(selectUserCurrency);

    if (!selectedGroup) {
        return { ...EMPTY_GROUP_SUMMARY, defaultCurrency };
    }

    return {
        ...calcGroupSummary(
            selectGroupBalances(selectedGroup),
            currencies.base,
            currencies.rates,
            defaultCurrency,
        ),
        defaultCurrency,
    };
};

export { useConnect };
