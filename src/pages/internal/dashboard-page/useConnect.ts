import { useShallow } from 'zustand/react/shallow';

import { useDashboardStore } from 'store/dashboardStore';
import { selectDashboardNextPageError } from 'store/errorsSelectors';
import { useErrorsStore } from 'store/errorsStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectDashboardFetched,
    selectDashboardLoading,
    selectDashboardNextPageLoading,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const {
        isDashboardFetched,
        isDashboardLoading,
        isNextPageLoading,
        isGroupListFetched,
    } = useLoadingStore(
        useShallow(state => ({
            isDashboardFetched: selectDashboardFetched(state),
            isDashboardLoading: selectDashboardLoading(state),
            isNextPageLoading: selectDashboardNextPageLoading(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );
    const { activityItems, activityNextCursor, fetchMoreDashboardActivity } =
        useDashboardStore(
            useShallow(state => ({
                activityItems: state.activityItems,
                activityNextCursor: state.activityNextCursor,
                fetchMoreDashboardActivity: state.fetchMoreDashboardActivity,
            })),
        );
    const groups = useGroupsStore(state => state.groups);
    const isNextPageError =
        useErrorsStore(selectDashboardNextPageError) !== null;
    const hasMoreActivity = activityNextCursor !== null;

    return {
        activityItems,
        fetchMoreDashboardActivity,
        groups,
        hasGroups: groups.length > 0,
        hasMoreActivity,
        isDashboardFetched,
        isDashboardLoading,
        isEndOfFeed:
            !isNextPageLoading &&
            !hasMoreActivity &&
            activityItems.length > 0,
        isGroupListFetched,
        isNextPageError,
        isNextPageLoading,
    };
};

export { useConnect };
