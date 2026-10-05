import { matchPath } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import {
    hasGroupExpenseTarget,
    isGroupExpenseTarget,
} from 'helpers/expenseTargets';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import {
    selectFriendsFetched,
    selectGroupDataFetched,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

const useAddExpenseAvailability = (pathname: string) => {
    const groupId = matchPath(
        { path: `${ROUTES.GROUP}/:groupId`, end: true },
        pathname,
    )?.params.groupId;
    const isFriendsPage = pathname === ROUTES.FRIENDS;
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isSoloModeFromStore = useDashboardStore(selectIsSoloMode);
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
        })),
    );
    const { friends, canAccessSolo } = useUsersStore(
        useShallow(state => ({
            friends: state.friends,
            canAccessSolo: selectCanAccessSolo(state),
        })),
    );
    const {
        isFriendsFetched,
        isGroupDataFetched,
        isGroupListFetched,
    } = useLoadingStore(
        useShallow(state => ({
            isFriendsFetched: selectFriendsFetched(state),
            isGroupDataFetched: selectGroupDataFetched(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );

    const hasResolvedFriendTarget =
        isFriendsFetched && friends.length > 0;
    const hasResolvedGroupTarget =
        isGroupListFetched && hasGroupExpenseTarget(groups);
    const routeGroup = groupId
        ? selectedGroup?.id === groupId
            ? selectedGroup
            : (groups.find(group => group.id === groupId) ?? null)
        : null;

    let isTargetAvailable = false;

    if (isFriendsPage) {
        isTargetAvailable = hasResolvedFriendTarget;
    } else if (groupId) {
        isTargetAvailable =
            (isGroupListFetched || isGroupDataFetched) &&
            isGroupExpenseTarget(routeGroup);
    } else {
        isTargetAvailable =
            hasResolvedFriendTarget || hasResolvedGroupTarget;
    }

    return {
        isSoloMode: canAccessSolo && isSoloModeFromStore,
        isVisible: isLoggedIn && isTargetAvailable,
    };
};

export { useAddExpenseAvailability };
