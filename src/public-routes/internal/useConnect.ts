import { useShallow } from 'zustand/react/shallow';

import { userSoloModeByDefault } from 'entities/users';
import { useCanAccessSolo, useUserSetting } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const { isAuthResolved, isLoggedIn } = useAuthStore(
        useShallow(state => ({
            isAuthResolved: selectIsAuthResolved(state),
            isLoggedIn: selectIsLoggedIn(state),
        })),
    );
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const soloModeByDefault = useUserSetting(userSoloModeByDefault);
    const canAccessSolo = useCanAccessSolo();

    return { isAuthResolved, isLoggedIn, isUserFetched, soloModeByDefault, canAccessSolo };
};

export { useConnect };
