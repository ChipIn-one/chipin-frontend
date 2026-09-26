import { useShallow } from 'zustand/react/shallow';

import { selectDashboardSummary } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { selectUserCurrency, useUsersStore } from 'store/users-store';

const useConnect = () => {
    const defaultCurrency = useUsersStore(selectUserCurrency);
    const { balances, currencies } = useDashboardStore(
        useShallow(state => ({
            balances: state.balances,
            currencies: state.currencies,
        })),
    );

    return {
        defaultCurrency,
        ...selectDashboardSummary({ balances, currencies }, defaultCurrency),
    };
};

export { useConnect };
