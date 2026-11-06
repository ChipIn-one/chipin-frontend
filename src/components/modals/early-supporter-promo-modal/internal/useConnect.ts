import { useSelfUser } from 'hooks/useSelfUser';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const isNewUser = useAuthStore(state => state.isNewUser);
    const isBackendUnavailable = useConnectivityStore(state => state.mode === 'backend-down');
    const user = useSelfUser();
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
