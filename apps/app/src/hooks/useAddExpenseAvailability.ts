import { matchPath } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { hasGroupExpenseTarget, isGroupExpenseTarget } from 'helpers/expenseTargets';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

import { useGroupDetail } from './useGroupDetail';
import { useGroupsList } from './useGroupsList';
import { useKnownUsers } from './useKnownUsers';
import { useCanAccessSolo, useSelfUser } from './useSelfUser';

const useAddExpenseAvailability = (pathname: string) => {
    const groupId = matchPath({ path: `${ROUTES.GROUP}/:groupId`, end: true }, pathname)?.params
        .groupId;
    const isFriendsPage = pathname === ROUTES.FRIENDS;
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isSoloModeFromStore = useUiPrefsStore(selectIsSoloMode);
    // The route's group: its detail, or the group as listed while the detail loads.
    const routeGroup = useGroupDetail(groupId).group ?? null;
    // Loaded or restored from the cache: data is a resolved group list.
    const listedGroups = useGroupsList().groups;
    const isGroupListResolved = listedGroups !== undefined;
    const groups = listedGroups ?? [];
    const { friends } = useKnownUsers();
    const canAccessSolo = useCanAccessSolo();
    // Data (loaded, seeded or restored from the cache) is a confirmed user.
    const currentUser = useSelfUser();

    // Loaded or restored from the cache: data is a resolved friend list.
    const hasResolvedFriendTarget = (friends?.length ?? 0) > 0;
    const hasResolvedGroupTarget = isGroupListResolved && hasGroupExpenseTarget(groups);

    // No target means no button. The Dashboard `welcome` view (no group at all and no friend)
    // never has a target, so its solid "Create group" stays the one primary action (#927).
    // The converse does not hold: a 1-member group is no target, yet the Dashboard is not
    // `welcome`. If the shell button is ever shown without a target, make it soft on `welcome`.
    let isTargetAvailable: boolean;

    if (isFriendsPage) {
        isTargetAvailable = hasResolvedFriendTarget;
    } else if (groupId) {
        isTargetAvailable = isGroupExpenseTarget(routeGroup);
    } else {
        isTargetAvailable = hasResolvedFriendTarget || hasResolvedGroupTarget;
    }

    return {
        isSoloMode: canAccessSolo && isSoloModeFromStore,
        isVisible: isLoggedIn && currentUser !== null && isTargetAvailable,
    };
};

export { useAddExpenseAvailability };
