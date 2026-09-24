import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const isNewUser = useAuthStore(state => state.isNewUser);
    const user = useUsersStore(state => state.user);

    return {
        isNewUser,
        subscriptionUntil: user?.subscriptionUntil ?? null,
        userId: user?.id ?? null,
    };
};

export { useConnect };
