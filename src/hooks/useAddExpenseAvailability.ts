import { matchPath } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { hasGroupExpenseTarget, isGroupExpenseTarget } from 'helpers/expenseTargets';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupDataFetched, selectGroupListFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

import { useKnownUsers } from './useKnownUsers';
import { useCanAccessSolo, useSelfUser } from './useSelfUser';

const useAddExpenseAvailability = (pathname: string) => {
    const groupId = matchPath({ path: `${ROUTES.GROUP}/:groupId`, end: true }, pathname)?.params
        .groupId;
    const isFriendsPage = pathname === ROUTES.FRIENDS;
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isSoloModeFromStore = useUiPrefsStore(selectIsSoloMode);
    const { groups, selectedGroup, hasConfirmedGroups } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
            hasConfirmedGroups: state.hasConfirmedGroups,
        })),
    );
    const { friends } = useKnownUsers();
    const canAccessSolo = useCanAccessSolo();
    // Data (loaded, seeded or restored from the cache) is a confirmed user.
    const currentUser = useSelfUser();
    const { isGroupDataFetched, isGroupListFetched } = useLoadingStore(
        useShallow(state => ({
            isGroupDataFetched: selectGroupDataFetched(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );

    // Loaded or restored from the cache: data is a resolved friend list.
    const hasResolvedFriendTarget = (friends?.length ?? 0) > 0;
    const hasResolvedGroupTarget =
        (isGroupListFetched || hasConfirmedGroups) && hasGroupExpenseTarget(groups);
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
            (isGroupListFetched || hasConfirmedGroups || isGroupDataFetched) &&
            isGroupExpenseTarget(routeGroup);
    } else {
        isTargetAvailable = hasResolvedFriendTarget || hasResolvedGroupTarget;
    }

    return {
        isSoloMode: canAccessSolo && isSoloModeFromStore,
        isVisible: isLoggedIn && currentUser !== null && isTargetAvailable,
    };
};

export { useAddExpenseAvailability };
