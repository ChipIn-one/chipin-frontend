import { useShallow } from 'zustand/react/shallow';

import { getActivityPreviewEvents } from 'helpers/activityEvent';
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
        hasConfirmedDashboardData,
        fetchMoreDashboardActivity,
    } = useDashboardStore(
        useShallow(state => ({
            activityItems: state.activityItems,
            activityNextCursor: state.activityNextCursor,
            hasConfirmedDashboardData: state.hasConfirmedDashboardData,
            fetchMoreDashboardActivity: state.fetchMoreDashboardActivity,
        })),
    );
    const groups = useGroupsStore(state => state.groups);
    const { friends, currentUser } = useUsersStore(
        useShallow(state => ({ friends: state.friends, currentUser: state.user })),
    );
    const {
        isDashboardFetched: isDashboardFetched || hasConfirmedDashboardData,
        isDashboardLoading: isDashboardLoading && !hasConfirmedDashboardData,
        isDashboardRefreshError: dashboardError !== null && hasConfirmedDashboardData,
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
    const hasConnections = hasGroups || friends.length > 0;
    const hasExpenseHistory =
        groups.some(group => group.lastUsedCurrency !== null) ||
        friends.some(friend => friend.lastUsedCurrency !== null);
    const hasMoreActivity = activityNextCursor !== null;
    const isOnboardingDataSettled =
        (isDashboardFetched || hasConfirmedDashboardData) &&
        isGroupListFetched &&
        isFriendsFetched &&
        isUserSelfFetched;
    const hasOnboardingDataError =
        (dashboardError !== null && !hasConfirmedDashboardData) ||
        groupListError !== null ||
        friendsError !== null ||
        userSelfError !== null ||
        currentUser === null;
    const dashboardView = !isOnboardingDataSettled
        ? 'loading'
        : hasOnboardingDataError
            ? 'error'
            : hasConnections
                ? 'dashboard'
                : 'welcome';
    const onRetryLoad = () => {
        Promise.all([
            useDashboardStore.getState().fetchSetDashboardData(),
            useGroupsStore.getState().fetchSetGroups(true),
            useUsersStore.getState().fetchSetFriends(true),
            useUsersStore.getState().fetchSetUser(true),
        ]).catch(() => undefined);
    };

    return {
        activityEvents,
        fetchMoreDashboardActivity,
        groups,
        dashboardView,
        hasGroups,
        hasExpenseHistory,
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
        onRetryLoad,
    };
};

export { useConnect };
