import { useSelfUser } from 'hooks/useSelfUser';
import { selectSettlementAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const user = useSelfUser();
    const isSubmitting = useLoadingStore(selectSettlementAdding);

    return { user, isSubmitting };
};

export { useConnect };
