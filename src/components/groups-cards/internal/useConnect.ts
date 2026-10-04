import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Group } from 'api/chipin.types';
import type { GroupDebtFilter } from 'constants/groups';
import { getUnixTimestampInSec } from 'helpers/time';
import { useDashboardStore } from 'store/dashboardStore';
import { selectGroupsCardsView } from 'store/groupsSelectors';
import {
    selectDashboardFetched,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserCurrency, useUsersStore } from 'store/users-store';

interface Options {
    groups: Group[];
    filter: GroupDebtFilter;
    query: string;
    selectedGroupId?: Group['id'];
}

const useConnect = ({
    groups,
    filter,
    query,
    selectedGroupId,
}: Options) => {
    const [nowTimestamp] = useState(() => getUnixTimestampInSec());

    const { isDashboardFetched, isGroupListFetched } = useLoadingStore(
        useShallow(state => ({
            isDashboardFetched: selectDashboardFetched(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );
    const currencies = useDashboardStore(state => state.currencies);
    const defaultCurrency = useUsersStore(selectUserCurrency);

    return {
        isReady: isDashboardFetched && isGroupListFetched,
        ...selectGroupsCardsView(groups, {
            filter,
            query,
            selectedGroupId,
            rates: currencies.rates,
            baseCurrency: currencies.base,
            defaultCurrency,
            nowTimestamp,
        }),
    };
};

export { useConnect };
