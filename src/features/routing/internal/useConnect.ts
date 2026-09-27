import { useShallow } from 'zustand/react/shallow';

import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

const useConnect = () => {
    return useAuthStore(
        useShallow(state => ({
            isAuthResolved: selectIsAuthResolved(state),
            isLoggedIn: selectIsLoggedIn(state),
            unauthReason: state.unauthReason,
        })),
    );
};

export { useConnect };
