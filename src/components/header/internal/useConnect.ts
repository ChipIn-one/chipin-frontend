import { useShallow } from 'zustand/react/shallow';

import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { selectCanAccessSolo, selectIsUserAdmin, useUsersStore } from 'store/users-store';

const useConnect = () => {
    const { isAuthResolved, isLoggedIn } = useAuthStore(useShallow(state => ({
        isAuthResolved: selectIsAuthResolved(state),
        isLoggedIn: selectIsLoggedIn(state),
    })));
    const { canAccessSolo, canShowDevMenu } = useUsersStore(useShallow(state => ({
        canAccessSolo: selectCanAccessSolo(state),
        canShowDevMenu: selectIsUserAdmin(state),
    })));
    const isSoloModeFromStore = useDashboardStore(selectIsSoloMode);
    return {
        isAuthResolved,
        isLoggedIn,
        canShowDevMenu,
        isSoloMode: canAccessSolo && isSoloModeFromStore,
    };
};

export { useConnect };
