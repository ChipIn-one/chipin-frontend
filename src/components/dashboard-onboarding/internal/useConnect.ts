import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const inviteToken = useUsersStore(
        state => state.user?.inviteToken ?? null,
    );

    return {
        inviteToken,
    };
};

export { useConnect };
