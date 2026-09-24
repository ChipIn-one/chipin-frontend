import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const isNewUser = useAuthStore(state => state.isNewUser);
    const isBackendUnavailable = useBackendAvailabilityStore(state => state.isUnavailable);
    const user = useUsersStore(state => state.user);

    return {
        isBackendUnavailable,
        isNewUser,
        subscriptionUntil: user?.subscriptionUntil ?? null,
        userId: user?.id ?? null,
    };
};

export { useConnect };
