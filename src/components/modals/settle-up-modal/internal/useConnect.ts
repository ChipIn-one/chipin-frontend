import { selectSettlementAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const user = useUsersStore(state => state.user);
    const isSubmitting = useLoadingStore(selectSettlementAdding);

    return { user, isSubmitting };
};

export { useConnect };
