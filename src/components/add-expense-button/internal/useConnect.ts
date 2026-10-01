import { matchPath } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { MIN_GROUP_EXPENSE_PARTICIPANTS } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectDashboardLoading,
    selectFriendsFetched,
    selectGroupDataFetched,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

export type AddExpenseUnavailableReason = 'dashboard' | 'friends' | 'group';

const useConnect = (pathname: string) => {
    const groupId = matchPath(
        { path: `${ROUTES.GROUP}/:groupId`, end: true },
        pathname,
    )?.params.groupId;
    const isFriendsPage = pathname === ROUTES.FRIENDS;
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isSoloModeFromStore = useDashboardStore(selectIsSoloMode);
    const onAddExpense = useExpenseModalStore(state => state.open);
    const { hasAvailableGroup, routeGroup } = useGroupsStore(
        useShallow(state => ({
            hasAvailableGroup: state.groups.some(
                group => group.members.length >= MIN_GROUP_EXPENSE_PARTICIPANTS,
            ),
            routeGroup: groupId
                ? state.selectedGroup?.id === groupId
                    ? state.selectedGroup
                    : (state.groups.find(group => group.id === groupId) ?? null)
                : null,
        })),
    );
    const { friends, canAccessSolo } = useUsersStore(
        useShallow(state => ({
            friends: state.friends,
            canAccessSolo: selectCanAccessSolo(state),
        })),
    );
    const {
        isDashboardLoading,
        isFriendsFetched,
        isGroupDataFetched,
        isGroupListFetched,
    } = useLoadingStore(
        useShallow(state => ({
            isDashboardLoading: selectDashboardLoading(state),
            isFriendsFetched: selectFriendsFetched(state),
            isGroupDataFetched: selectGroupDataFetched(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );

    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const hasFriends = friends.length > 0;
    let canAddExpense: boolean;
    let areTargetsResolved: boolean;
    let unavailableReason: AddExpenseUnavailableReason;

    if (isFriendsPage) {
        canAddExpense = hasFriends;
        areTargetsResolved = hasFriends || isFriendsFetched;
        unavailableReason = 'friends';
    } else if (groupId) {
        canAddExpense =
            (routeGroup?.members.length ?? 0) >= MIN_GROUP_EXPENSE_PARTICIPANTS;
        areTargetsResolved =
            canAddExpense ||
            routeGroup !== null ||
            (isGroupListFetched && isGroupDataFetched);
        unavailableReason = 'group';
    } else {
        canAddExpense = hasFriends || hasAvailableGroup;
        areTargetsResolved =
            canAddExpense || (isFriendsFetched && isGroupListFetched);
        unavailableReason = 'dashboard';
    }

    const isUnavailable = areTargetsResolved && !canAddExpense;
    const isButtonLoading =
        !areTargetsResolved || (isDashboardLoading && canAddExpense);

    return {
        isLoggedIn,
        isSoloMode,
        isUnavailable,
        isButtonLoading,
        unavailableReason: isUnavailable ? unavailableReason : null,
        onAddExpense,
    };
};

export { useConnect };
