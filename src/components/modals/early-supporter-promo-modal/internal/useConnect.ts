import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const isNewUser = useAuthStore(state => state.isNewUser);
    const isBackendUnavailable = useBackendAvailabilityStore(state => state.isUnavailable);
    const user = useUsersStore(state => state.user);
    const premiumPromoRemaining = useUsersStore(state => state.premiumPromoRemaining);
    const isPremiumPromoResolved = useUsersStore(state => state.isPremiumPromoResolved);

    return {
        isBackendUnavailable,
        isNewUser,
        isPremiumPromoResolved,
        premiumPromoRemaining,
        subscriptionUntil: user?.subscriptionUntil ?? null,
        userId: user?.id ?? null,
    };
};

export { useConnect };
