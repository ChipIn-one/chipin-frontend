import { useShallow } from 'zustand/react/shallow';

import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, selectUserSettings, useUsersStore } from 'store/users-store';

const useConnect = () => {
    const { isAuthResolved, isLoggedIn } = useAuthStore(useShallow(state => ({
        isAuthResolved: selectIsAuthResolved(state),
        isLoggedIn: selectIsLoggedIn(state),
    })));
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const { settings, canAccessSolo } = useUsersStore(useShallow(state => ({
        settings: selectUserSettings(state),
        canAccessSolo: selectCanAccessSolo(state),
    })));
    return { isAuthResolved, isLoggedIn, isUserFetched, settings, canAccessSolo };
};

export { useConnect };
