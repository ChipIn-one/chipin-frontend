import { useExpenseModalStore } from 'store/expenseModalStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const inviteToken = useUsersStore(
        state => state.user?.inviteToken ?? null,
    );
    const openExpenseModal = useExpenseModalStore(state => state.open);

    return {
        inviteToken,
        openExpenseModal,
    };
};

export { useConnect };
