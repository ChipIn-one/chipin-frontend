import { useShallow } from 'zustand/react/shallow';

import type { BadgeItem } from 'basics/BalanceBadges';
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
    const summary = selectDashboardSummary({ balances, currencies }, defaultCurrency);

    const owedBadgeItems = summary.owedEntries.map<BadgeItem>(entry => ({
        tokenCode: entry.currency,
        value: entry.netBalance,
        color: 'grass',
    }));

    const oweBadgeItems = summary.oweEntries.map<BadgeItem>(entry => ({
        tokenCode: entry.currency,
        value: Math.abs(entry.netBalance),
        color: 'tomato',
    }));

    return {
        defaultCurrency,
        ...summary,
        owedBadgeItems,
        oweBadgeItems,
    };
};

export { useConnect };
