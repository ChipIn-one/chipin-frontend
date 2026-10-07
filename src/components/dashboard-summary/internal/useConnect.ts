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

    const owedBadgeItems = summary.owedEntries.reduce<BadgeItem[]>((items, entry) => {
        if (entry.netBalance > 0) {
            items.push({
                tokenCode: entry.currency,
                value: entry.netBalance,
                color: 'grass',
            });
        }

        return items;
    }, []);

    const oweBadgeItems = summary.oweEntries.reduce<BadgeItem[]>((items, entry) => {
        if (entry.netBalance < 0) {
            items.push({
                tokenCode: entry.currency,
                value: Math.abs(entry.netBalance),
                color: 'tomato',
            });
        }

        return items;
    }, []);

    return {
        defaultCurrency,
        ...summary,
        owedBadgeItems,
        oweBadgeItems,
    };
};

export { useConnect };
