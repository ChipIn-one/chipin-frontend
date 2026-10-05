import { useShallow } from 'zustand/react/shallow';

import { getActivityPreviewEvents } from 'helpers/activityEvent';
import { hasGroupExpenseTarget } from 'helpers/expenseTargets';
import { useDashboardStore } from 'store/dashboardStore';
import { useErrorsStore } from 'store/errorsStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectDashboardFetched,
    selectDashboardLoading,
    selectDashboardNextPageLoading,
    selectFriendsFetched,
    selectGroupListFetched,
    selectUserSelfFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const {
        activityItems,
        activityNextCursor,
        fetchMoreDashboardActivity,
    } = useDashboardStore(
        useShallow(state => ({
            activityItems: state.activityItems,
            activityNextCursor: state.activityNextCursor,
            fetchMoreDashboardActivity: state.fetchMoreDashboardActivity,
        })),
    );
    const groups = useGroupsStore(state => state.groups);
    const friends = useUsersStore(state => state.friends);
    const {
        isDashboardFetched,
        isDashboardLoading,
        isNextPageLoading,
        isGroupListFetched,
        isFriendsFetched,
        isUserSelfFetched,
    } = useLoadingStore(
        useShallow(state => ({
            isDashboardFetched: selectDashboardFetched(state),
            isDashboardLoading: selectDashboardLoading(state),
            isNextPageLoading: selectDashboardNextPageLoading(state),
            isGroupListFetched: selectGroupListFetched(state),
            isFriendsFetched: selectFriendsFetched(state),
            isUserSelfFetched: selectUserSelfFetched(state),
        })),
    );
    const {
        dashboardError,
        nextPageError,
        groupListError,
        friendsError,
        userSelfError,
    } = useErrorsStore(
        useShallow(state => ({
            dashboardError: state.errors.dashboard.data,
            nextPageError: state.errors.dashboard.nextPage,
            groupListError: state.errors.group.list,
            friendsError: state.errors.users.friends,
            userSelfError: state.errors.users.self,
        })),
    );

    const activityEvents = getActivityPreviewEvents(activityItems);
    const hasGroups = groups.length > 0;
    const hasFriendTarget = friends.length > 0;
    const hasGroupTarget = hasGroupExpenseTarget(groups);
    const hasMoreActivity = activityNextCursor !== null;
    const isOnboardingDataResolved =
        isDashboardFetched &&
        isGroupListFetched &&
        isFriendsFetched &&
        isUserSelfFetched &&
        dashboardError === null &&
        groupListError === null &&
        friendsError === null &&
        userSelfError === null;

    return {
        activityEvents,
        fetchMoreDashboardActivity,
        groups,
        hasFriendTarget,
        hasGroupTarget,
        hasGroups,
        hasMoreActivity,
        isDashboardFetched,
        isDashboardLoading,
        isEndOfFeed:
            !isNextPageLoading &&
            !hasMoreActivity &&
            activityItems.length > 0,
        isGroupListFetched,
        isNextPageError: nextPageError !== null,
        isNextPageLoading,
        isOnboardingVisible:
            isOnboardingDataResolved && activityItems.length === 0,
    };
};

export { useConnect };
